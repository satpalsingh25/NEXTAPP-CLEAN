import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, APPROVER_PLUS } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireRole(req, APPROVER_PLUS);
  if ("error" in auth) return auth.error;
  const { user_id, company_id, role } = auth.user;

  try {
    const matrixEntries = await prisma.complianceApprovalMatrix.findMany({
      where: { approver_id: user_id },
      select: { template_id: true, level: true },
    });

    const companyFilter = role === "SUPER_ADMIN" ? {} : { company_id };

    const allSubmitted = await prisma.compliance.findMany({
      where: { status: "SUBMITTED", ...companyFilter },
      include: {
        template: { select: { id: true, title: true, approval_levels: true } },
      },
      orderBy: { due_date: "asc" },
    });

    const assignedKeys = new Set(matrixEntries.map((m) => `${m.template_id}:${m.level}`));

    const userIds = [
      ...new Set([
        ...allSubmitted.map((r) => r.submitted_by),
        ...allSubmitted.map((r) => r.approved_by),
      ].filter(Boolean) as string[]),
    ];

    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const recordIds = allSubmitted.map((r) => r.id);
    const histories =
      recordIds.length > 0
        ? await prisma.approvalLog.findMany({
            where: { record_id: { in: recordIds }, module: "COMPLIANCE" },
            orderBy: [{ record_id: "asc" }, { level_number: "asc" }, { timestamp: "asc" }],
          })
        : [];

    const historyByRecord: Record<string, typeof histories> = {};
    for (const h of histories) {
      if (!historyByRecord[h.record_id]) historyByRecord[h.record_id] = [];
      historyByRecord[h.record_id].push(h);
    }

    const now = new Date();

    const result = allSubmitted.map((r) => {
      const key = `${r.template_id}:${r.current_level}`;
      const isAssigned = assignedKeys.has(key);
      const submitter = r.submitted_by ? userMap[r.submitted_by] ?? null : null;
      const history = (historyByRecord[r.id] ?? []).map((h) => ({
        id: h.id,
        level: h.level_number,
        action: h.action,
        remarks: h.remarks ?? "",
        acted_by: h.action_by ? (userMap[h.action_by] ?? null) : null,
        acted_at: h.timestamp,
      }));
      return {
        id: r.id,
        module: "COMPLIANCE",
        title: r.title || r.template?.title || "—",
        due_date: r.due_date,
        is_overdue: r.due_date < now,
        status: r.status,
        current_level: r.current_level,
        total_levels: r.template?.approval_levels ?? 1,
        template: r.template,
        submitter_name: submitter?.name ?? null,
        submitter_email: submitter?.email ?? null,
        created_at: r.created_at,
        is_assigned: isAssigned,
        history,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, APPROVER_PLUS } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireRole(req, APPROVER_PLUS);
  if ("error" in auth) return auth.error;
  const { user_id, company_id, role } = auth.user;

  try {
    const matrixEntries = await prisma.aMCApprovalMatrix.findMany({
      where: { approver_id: user_id },
      select: { template_id: true, level: true },
    });

    const companyFilter = role === "SUPER_ADMIN" ? {} : { company_id };

    const allSubmitted = await prisma.aMC.findMany({
      where: { status: "SUBMITTED", ...companyFilter },
      include: {
        amcTemplate: { select: { id: true, name: true, approval_levels: true } },
        asset: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { expiry_date: "asc" },
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
            where: { record_id: { in: recordIds }, module: "AMC" },
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
      const key = `${r.amc_template_id}:${r.current_level}`;
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
        module: "AMC",
        title: r.title || r.amcTemplate?.name || "—",
        due_date: r.expiry_date ?? null,
        is_overdue: r.expiry_date ? r.expiry_date < now : false,
        status: r.status,
        current_level: r.current_level,
        total_levels: r.amcTemplate?.approval_levels ?? 1,
        template: r.amcTemplate ? { id: r.amcTemplate.id, title: r.amcTemplate.name, approval_levels: r.amcTemplate.approval_levels } : null,
        asset: r.asset,
        vendor: r.vendor,
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

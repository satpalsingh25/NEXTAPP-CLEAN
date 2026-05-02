import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import { gateModule } from "@/lib/module-access";
import { checkCompanyAccess } from "@/lib/permission";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "COMPLIANCE");
  if (gate) return gate;

  const { company_id } = auth.user;
  const { id } = await params;

  try {
    const record = await prisma.compliance.findFirst({
      where: { id, company_id },
      include: {
        template: { select: { id: true, title: true, approval_levels: true, frequency: true } },
      },
    });

    if (!record) {
      console.warn("[security] compliance record not found or cross-tenant attempt:", auth.user.user_id, id);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const logs = await prisma.approvalLog.findMany({
      where: { record_id: id, module: "COMPLIANCE" },
      orderBy: { timestamp: "asc" },
    });

    const userIds = [...new Set([
      ...logs.map((l) => l.action_by),
      record.submitted_by,
      record.approved_by,
    ].filter(Boolean))] as string[];

    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const userMap = Object.fromEntries(
      users.map((u) => [u.id, { name: u.name, email: u.email }])
    );

    const enrichedLogs = logs.map((l) => ({
      ...l,
      actor_name:  userMap[l.action_by]?.name  ?? null,
      actor_email: userMap[l.action_by]?.email ?? null,
    }));

    const submitter = record.submitted_by ? userMap[record.submitted_by] : null;
    const approver  = record.approved_by  ? userMap[record.approved_by]  : null;

    return NextResponse.json({
      ...record,
      submitter_name:  submitter?.name  ?? null,
      submitter_email: submitter?.email ?? null,
      approver_name:   approver?.name   ?? null,
      approver_email:  approver?.email  ?? null,
      approval_logs: enrichedLogs,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

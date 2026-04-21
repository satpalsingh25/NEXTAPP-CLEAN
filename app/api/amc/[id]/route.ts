import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import { gateModule } from "@/lib/module-access";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "AMC");
  if (gate) return gate;

  const { id } = await params;

  try {
    const record = await prisma.aMC.findUnique({
      where: { id },
      include: {
        amcTemplate: { select: { id: true, name: true, approval_levels: true, frequency: true } },
        asset: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        businessFunction: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        approval_levels: { orderBy: { level: "asc" } },
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const logs = await prisma.approvalLog.findMany({
      where: { record_id: id, module: "AMC" },
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
    const userMap = Object.fromEntries(users.map((u) => [u.id, { email: u.email, name: u.name }]));

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

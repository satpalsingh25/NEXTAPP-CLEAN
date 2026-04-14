import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, SUBMIT_ROLES } from "@/lib/auth.server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, SUBMIT_ROLES);
  if ("error" in auth) return auth.error;
  const { user_id } = auth.user;

  const { id } = await params;

  try {
    const record = await prisma.aMC.findUnique({
      where: { id },
      include: { approval_levels: true },
    });

    if (!record) return NextResponse.json({ error: "AMC record not found" }, { status: 404 });

    if (record.status !== "REJECTED") {
      return NextResponse.json({ error: `Only REJECTED records can be resubmitted (current: "${record.status}")` }, { status: 400 });
    }

    if (record.assigned_user_id && record.assigned_user_id !== user_id) {
      return NextResponse.json({ error: "Only the assigned user can resubmit this record." }, { status: 403 });
    }

    if (record.approval_levels.length === 0) {
      return NextResponse.json(
        { error: "Approval matrix is incomplete. Please configure approver levels before resubmitting." },
        { status: 400 }
      );
    }

    const [updated] = await prisma.$transaction([
      prisma.aMC.update({
        where: { id },
        data: {
          status: "SUBMITTED",
          current_level: 1,
          current_approval_level: 1,
          submitted_by: user_id,
          submitted_at: new Date(),
        },
      }),
      prisma.approvalLog.create({
        data: {
          company_id: record.company_id,
          module: "AMC",
          record_id: id,
          level_number: 0,
          action: "SUBMITTED",
          action_by: user_id,
          remarks: "Resubmitted after rejection",
        },
      }),
    ]);

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

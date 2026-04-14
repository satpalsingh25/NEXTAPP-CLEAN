import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, APPROVER_PLUS } from "@/lib/auth.server";

export async function POST(req: NextRequest) {
  const auth = requireRole(req, APPROVER_PLUS);
  if ("error" in auth) return auth.error;
  const { user_id, company_id, role } = auth.user;

  const body = await req.json().catch(() => ({}));
  const { approval_id, action, remarks = "" } = body as {
    approval_id: string;
    action: "approve" | "reject";
    remarks?: string;
  };

  if (!approval_id) {
    return NextResponse.json({ error: "approval_id is required" }, { status: 400 });
  }
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }
  if (action === "reject" && !remarks?.trim()) {
    return NextResponse.json({ error: "Remarks are required to reject." }, { status: 400 });
  }

  try {
    const approvalLevel = await prisma.aMCApprovalLevel.findUnique({
      where: { id: approval_id },
      include: {
        amc: {
          include: { amcTemplate: { select: { approval_levels: true } } },
        },
      },
    });

    if (!approvalLevel) {
      return NextResponse.json({ error: "Approval record not found" }, { status: 404 });
    }

    if (approvalLevel.approver_id !== user_id) {
      return NextResponse.json({ error: "You are not the designated approver for this level" }, { status: 403 });
    }

    if (approvalLevel.status !== "PENDING") {
      return NextResponse.json({ error: `Cannot act on an approval with status "${approvalLevel.status}"` }, { status: 400 });
    }

    const amc = approvalLevel.amc;

    if (role !== "SUPER_ADMIN" && amc.company_id !== company_id) {
      return NextResponse.json({ error: "Company mismatch" }, { status: 403 });
    }

    if (amc.status !== "SUBMITTED") {
      return NextResponse.json({ error: `AMC record status is "${amc.status}", expected SUBMITTED` }, { status: 400 });
    }

    const maxLevel = amc.amcTemplate?.approval_levels ?? approvalLevel.level;
    const now = new Date();

    if (action === "approve") {
      const isLastLevel = approvalLevel.level >= maxLevel;

      await prisma.$transaction([
        prisma.aMCApprovalLevel.update({
          where: { id: approval_id },
          data: { status: "APPROVED", acted_at: now, remarks: remarks.trim() || null },
        }),
        prisma.aMC.update({
          where: { id: amc.id },
          data: isLastLevel
            ? { status: "APPROVED", approved_by: user_id }
            : {
                current_level: amc.current_level + 1,
                current_approval_level: amc.current_level + 1,
              },
        }),
        prisma.approvalLog.create({
          data: {
            company_id: amc.company_id,
            module: "AMC",
            record_id: amc.id,
            level_number: approvalLevel.level,
            action: "APPROVED",
            action_by: user_id,
            remarks: remarks.trim() || null,
          },
        }),
      ]);

      return NextResponse.json({ success: true, final: isLastLevel });
    } else {
      await prisma.$transaction([
        prisma.aMCApprovalLevel.update({
          where: { id: approval_id },
          data: { status: "REJECTED", acted_at: now, remarks: remarks.trim() },
        }),
        prisma.aMC.update({
          where: { id: amc.id },
          data: { status: "REJECTED", current_level: 0, current_approval_level: 0 },
        }),
        prisma.approvalLog.create({
          data: {
            company_id: amc.company_id,
            module: "AMC",
            record_id: amc.id,
            level_number: approvalLevel.level,
            action: "REJECTED",
            action_by: user_id,
            remarks: remarks.trim(),
          },
        }),
      ]);

      return NextResponse.json({ success: true, final: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

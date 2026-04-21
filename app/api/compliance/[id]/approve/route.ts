import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, APPROVER_PLUS } from "@/lib/auth.server";
import { gateModule } from "@/lib/module-access";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, APPROVER_PLUS);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "COMPLIANCE");
  if (gate) return gate;
  const { user_id } = auth.user;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const remarks: string = (body.remarks ?? "").trim();

  if (!remarks) {
    return NextResponse.json({ error: "Remarks are required to approve." }, { status: 400 });
  }

  try {
    const record = await prisma.compliance.findUnique({
      where: { id },
      include: { template: true },
    });

    if (!record) return NextResponse.json({ error: "Compliance record not found" }, { status: 404 });

    if (record.status !== "SUBMITTED") {
      return NextResponse.json({ error: `Cannot approve a record with status "${record.status}"` }, { status: 400 });
    }

    const matrixEntry = await prisma.complianceApprovalMatrix.findFirst({
      where: { template_id: record.template_id, level: record.current_level },
    });

    if (!matrixEntry || matrixEntry.approver_id !== user_id) {
      return NextResponse.json({ error: "You are not the designated approver for the current level" }, { status: 403 });
    }

    const approvalLevels = record.template?.approval_levels ?? 1;
    const isLastLevel = record.current_level >= approvalLevels;

    const [updated] = await prisma.$transaction([
      prisma.compliance.update({
        where: { id },
        data: isLastLevel
          ? { status: "APPROVED", approved_by: user_id }
          : { current_level: record.current_level + 1, status: "SUBMITTED" },
      }),
      prisma.approvalLog.create({
        data: {
          company_id: record.company_id,
          module: "COMPLIANCE",
          record_id: id,
          level_number: record.current_level,
          action: "APPROVED",
          action_by: user_id,
          remarks,
        },
      }),
    ]);

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

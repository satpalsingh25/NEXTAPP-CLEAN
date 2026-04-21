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
  const gate = await gateModule(req, "AMC");
  if (gate) return gate;
  const { user_id } = auth.user;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const remarks: string = (body.remarks ?? "").trim();

  if (!remarks) {
    return NextResponse.json({ error: "Remarks are required to reject." }, { status: 400 });
  }

  try {
    const record = await prisma.aMC.findUnique({
      where: { id },
      include: { approval_levels: true },
    });

    if (!record) return NextResponse.json({ error: "AMC record not found" }, { status: 404 });

    if (record.status !== "SUBMITTED") {
      return NextResponse.json({ error: `Cannot reject a record with status "${record.status}"` }, { status: 400 });
    }

    const levelEntry = record.approval_levels.find((al) => al.level === record.current_level);

    if (!levelEntry || levelEntry.approver_id !== user_id) {
      return NextResponse.json({ error: "You are not the designated approver for the current level" }, { status: 403 });
    }

    const [updated] = await prisma.$transaction([
      prisma.aMC.update({
        where: { id },
        data: { status: "REJECTED", current_level: 0, current_approval_level: 0, approved_by: user_id },
      }),
      prisma.approvalLog.create({
        data: {
          company_id: record.company_id,
          module: "AMC",
          record_id: id,
          level_number: record.current_level,
          action: "REJECTED",
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

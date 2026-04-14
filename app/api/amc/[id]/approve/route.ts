import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, APPROVER_PLUS } from "@/lib/auth.server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, APPROVER_PLUS);
  if ("error" in auth) return auth.error;
  const { user_id } = auth.user;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const remarks: string = (body.remarks ?? "").trim();

  if (!remarks) {
    return NextResponse.json({ error: "Remarks are required to approve." }, { status: 400 });
  }

  try {
    const record = await prisma.aMC.findUnique({
      where: { id },
      include: {
        amcTemplate: { select: { approval_levels: true } },
        approval_levels: { orderBy: { level: "asc" } },
      },
    });

    if (!record) return NextResponse.json({ error: "AMC record not found" }, { status: 404 });

    if (record.status !== "SUBMITTED") {
      return NextResponse.json({ error: `Cannot approve a record with status "${record.status}"` }, { status: 400 });
    }

    const levelEntry = record.approval_levels.find((al) => al.level === record.current_level);

    if (!levelEntry || levelEntry.approver_id !== user_id) {
      return NextResponse.json({ error: "You are not the designated approver for the current level" }, { status: 403 });
    }

    const maxLevel = record.amcTemplate?.approval_levels ?? record.approval_levels.length;
    const isLastLevel = record.current_level >= maxLevel;

    const [updated] = await prisma.$transaction([
      prisma.aMC.update({
        where: { id },
        data: isLastLevel
          ? { status: "APPROVED", approved_by: user_id }
          : {
              current_level: record.current_level + 1,
              current_approval_level: record.current_level + 1,
              status: "SUBMITTED",
            },
      }),
      prisma.approvalLog.create({
        data: {
          company_id: record.company_id,
          module: "AMC",
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

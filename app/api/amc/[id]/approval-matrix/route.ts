import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const amc = await prisma.aMC.findUnique({
      where: { id },
      include: {
        amcTemplate: { select: { id: true, name: true, approval_levels: true } },
        approval_levels: {
          orderBy: { level: "asc" },
          select: { id: true, level: true, approver_id: true },
        },
      },
    });

    if (!amc) return NextResponse.json({ error: "AMC not found" }, { status: 404 });

    return NextResponse.json({
      required_levels: amc.amcTemplate?.approval_levels ?? 0,
      levels: amc.approval_levels,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  try {
    const amc = await prisma.aMC.findUnique({ where: { id }, select: { id: true } });
    if (!amc) return NextResponse.json({ error: "AMC not found" }, { status: 404 });

    const { count } = await prisma.aMCApprovalLevel.deleteMany({ where: { amc_id: id } });
    return NextResponse.json({ deleted: count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const body = await req.json();
    const { levels } = body as { levels: { level: number; approverId: string }[] };

    if (!Array.isArray(levels) || levels.length === 0) {
      return NextResponse.json({ error: "levels array is required" }, { status: 400 });
    }

    const amc = await prisma.aMC.findUnique({
      where: { id },
      include: { amcTemplate: { select: { approval_levels: true } } },
    });

    if (!amc) return NextResponse.json({ error: "AMC not found" }, { status: 404 });

    const required = amc.amcTemplate?.approval_levels ?? 0;

    if (levels.length !== required) {
      return NextResponse.json(
        { error: `Exactly ${required} level(s) required; got ${levels.length}` },
        { status: 400 }
      );
    }

    const sortedLvls = [...levels].sort((a, b) => a.level - b.level);
    for (let i = 0; i < sortedLvls.length; i++) {
      if (sortedLvls[i].level !== i + 1) {
        return NextResponse.json({ error: `Levels must be sequential: 1 … ${required}` }, { status: 400 });
      }
    }

    const approverIds = levels.map((l) => l.approverId);
    if (new Set(approverIds).size !== approverIds.length) {
      return NextResponse.json({ error: "Duplicate approvers are not allowed" }, { status: 400 });
    }

    await prisma.aMCApprovalLevel.deleteMany({ where: { amc_id: id } });

    const created = await prisma.aMCApprovalLevel.createMany({
      data: levels.map((l) => ({
        amc_id: id,
        level: l.level,
        approver_id: l.approverId,
      })),
    });

    return NextResponse.json({ count: created.count }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

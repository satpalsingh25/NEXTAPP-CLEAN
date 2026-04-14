import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, role } = auth.user;

  const { id: compliance_id } = await params;

  try {
    // Load compliance + its template's approval_levels in one query
    const compliance = await prisma.compliance.findUnique({
      where: { id: compliance_id },
      select: {
        id:         true,
        company_id: true,
        template:   { select: { id: true, approval_levels: true, title: true } },
      },
    });

    if (!compliance) {
      return NextResponse.json({ error: "Compliance record not found." }, { status: 404 });
    }
    if (role !== "SUPER_ADMIN" && compliance.company_id !== company_id) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const requiredLevels = compliance.template?.approval_levels ?? 1;

    const body = await req.json();
    const { levels } = body as { levels: { level: number; approverId: string }[] };

    if (!Array.isArray(levels) || levels.length === 0) {
      return NextResponse.json({ error: "levels must be a non-empty array." }, { status: 400 });
    }

    // --- structural validation ---

    // 1. Exact count must match template
    if (levels.length !== requiredLevels) {
      return NextResponse.json(
        {
          error: `Template "${compliance.template?.title}" requires exactly ${requiredLevels} approval level${requiredLevels !== 1 ? "s" : ""}. Got ${levels.length}.`,
        },
        { status: 400 }
      );
    }

    const levelNums = levels.map((l) => Number(l.level));

    // 2. No duplicates
    if (new Set(levelNums).size !== levelNums.length) {
      const dupes = levelNums.filter((n, i) => levelNums.indexOf(n) !== i);
      return NextResponse.json(
        { error: `Duplicate level${dupes.length > 1 ? "s" : ""}: ${[...new Set(dupes)].join(", ")}.` },
        { status: 400 }
      );
    }

    // 3. Levels must be exactly 1, 2, …, requiredLevels (sequential, no gaps, no extras)
    const sorted = [...levelNums].sort((a, b) => a - b);
    const expected = Array.from({ length: requiredLevels }, (_, i) => i + 1);
    const isSequential = sorted.every((n, i) => n === expected[i]);

    if (!isSequential) {
      return NextResponse.json(
        {
          error: `Levels must be sequential from 1 to ${requiredLevels}. Expected: [${expected.join(", ")}], got: [${sorted.join(", ")}].`,
        },
        { status: 400 }
      );
    }

    // 4. All approverIds must be non-empty strings
    const approverIds = levels.map((l) => l.approverId);
    if (approverIds.some((id) => !id || typeof id !== "string")) {
      return NextResponse.json({ error: "Each level must have a valid approverId." }, { status: 400 });
    }

    // 5. No duplicate approvers
    if (new Set(approverIds).size !== approverIds.length) {
      return NextResponse.json({ error: "Each level must have a different approver." }, { status: 400 });
    }

    // 6. All approvers must be active users in this company
    const targetCompanyId = role === "SUPER_ADMIN" ? compliance.company_id : company_id;
    const users = await prisma.user.findMany({
      where: { id: { in: approverIds }, company_id: targetCompanyId, is_active: true },
      select: { id: true },
    });
    const foundIds = new Set(users.map((u) => u.id));
    const notFound = approverIds.filter((id) => !foundIds.has(id));
    if (notFound.length > 0) {
      return NextResponse.json(
        { error: `Approver(s) not found or inactive in this company: ${notFound.join(", ")}` },
        { status: 400 }
      );
    }

    // Atomically replace the matrix
    const created = await prisma.$transaction(async (tx) => {
      await tx.complianceApprovalLevel.deleteMany({ where: { compliance_id } });

      return tx.complianceApprovalLevel.createMany({
        data: levels.map((l) => ({
          compliance_id,
          level:       Number(l.level),
          approver_id: l.approverId,
          status:      "PENDING",
        })),
      });
    });

    const matrix = await prisma.complianceApprovalLevel.findMany({
      where:   { compliance_id },
      orderBy: { level: "asc" },
    });

    return NextResponse.json({ count: created.count, levels: matrix }, { status: 201 });
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
  const { company_id, role } = auth.user;
  const { id: compliance_id } = await params;

  try {
    const compliance = await prisma.compliance.findUnique({
      where:  { id: compliance_id },
      select: { id: true, company_id: true },
    });
    if (!compliance) return NextResponse.json({ error: "Compliance record not found." }, { status: 404 });
    if (role !== "SUPER_ADMIN" && compliance.company_id !== company_id) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const { count } = await prisma.complianceApprovalLevel.deleteMany({ where: { compliance_id } });
    return NextResponse.json({ deleted: count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, role } = auth.user;

  const { id: compliance_id } = await params;

  try {
    const compliance = await prisma.compliance.findUnique({
      where:  { id: compliance_id },
      select: {
        id:         true,
        company_id: true,
        template:   { select: { id: true, approval_levels: true, title: true } },
      },
    });

    if (!compliance) {
      return NextResponse.json({ error: "Compliance record not found." }, { status: 404 });
    }
    if (role !== "SUPER_ADMIN" && compliance.company_id !== company_id) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const matrix = await prisma.complianceApprovalLevel.findMany({
      where:   { compliance_id },
      orderBy: { level: "asc" },
    });

    const approverIds = matrix.map((m) => m.approver_id);
    const users = approverIds.length > 0
      ? await prisma.user.findMany({
          where:  { id: { in: approverIds } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const enriched = matrix.map((m) => ({
      ...m,
      approver: userMap[m.approver_id] ?? null,
    }));

    return NextResponse.json({
      required_levels: compliance.template?.approval_levels ?? 1,
      levels: enriched,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, APPROVER_PLUS } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireRole(req, APPROVER_PLUS);
  if ("error" in auth) return auth.error;
  const { user_id, company_id, role } = auth.user;

  try {
    const company_filter = role === "SUPER_ADMIN" ? {} : { company_id };

    const amcs = await prisma.aMC.findMany({
      where: {
        ...company_filter,
        status: "SUBMITTED",
        approval_levels: {
          some: { approver_id: user_id },
        },
      },
      include: {
        amcTemplate: { select: { id: true, name: true, approval_levels: true } },
        approval_levels: { orderBy: { level: "asc" } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { submitted_at: "desc" },
    });

    const submitterIds = [...new Set(amcs.map((r) => r.submitted_by).filter(Boolean) as string[])];
    const submitters = submitterIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: submitterIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const submitterMap = Object.fromEntries(submitters.map((u) => [u.id, u]));

    const pendingForUser = amcs.filter((r) => {
      const levelEntry = r.approval_levels.find((al) => al.level === r.current_level);
      return levelEntry?.approver_id === user_id;
    });

    const result = pendingForUser.map((r) => ({
      ...r,
      submitted_by_user: r.submitted_by ? (submitterMap[r.submitted_by] ?? null) : null,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

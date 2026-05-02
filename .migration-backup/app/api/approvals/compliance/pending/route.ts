import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, APPROVER_PLUS } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireRole(req, APPROVER_PLUS);
  if ("error" in auth) return auth.error;
  const { user_id, company_id, role } = auth.user;

  try {
    const companyFilter = role === "SUPER_ADMIN" ? {} : { company_id };

    const records = await prisma.compliance.findMany({
      where: {
        ...companyFilter,
        status: "SUBMITTED",
        approval_levels: {
          some: { approver_id: user_id },
        },
      },
      include: {
        template: { select: { title: true, approval_levels: true } },
        approval_levels: { select: { id: true, level: true, approver_id: true } },
      },
      orderBy: { due_date: "asc" },
    });

    const pending = records.filter((r) => {
      const levelEntry = r.approval_levels.find((al) => al.level === r.current_level);
      return levelEntry?.approver_id === user_id;
    });

    const submitterIds = [...new Set(pending.map((r) => r.submitted_by).filter(Boolean) as string[])];
    const submitters = submitterIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: submitterIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const submitterMap = Object.fromEntries(submitters.map((u) => [u.id, u]));

    const result = pending.map((r) => {
      const levelEntry = r.approval_levels.find((al) => al.level === r.current_level)!;
      return {
        id: r.id,
        approval_level_id: levelEntry.id,
        name: r.name || r.template?.title || "—",
        submitted_by: r.submitted_by
          ? (submitterMap[r.submitted_by]?.name ?? submitterMap[r.submitted_by]?.email ?? "—")
          : "—",
        due_date: r.due_date,
        level: r.current_level,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

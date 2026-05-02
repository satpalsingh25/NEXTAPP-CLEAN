import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import { gateModule } from "@/lib/module-access";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "COMPLIANCE");
  if (gate) return gate;
  const { user_id, company_id, role } = auth.user;

  try {
    const now = new Date();

    let whereClause: Record<string, unknown> = { company_id };

    if (role === "SUPER_ADMIN") {
      whereClause = {};
    } else if (role === "USER" || role === "CEO") {
      whereClause = { company_id, assigned_user_id: user_id };
    } else if (role === "APPROVER" || role === "CHECKER") {
      whereClause = {
        company_id,
        approval_levels: { some: { approver_id: user_id } },
      };
    }

    const records = await prisma.compliance.findMany({
      where: whereClause as any,
      include: {
        template: { select: { title: true, approval_levels: true } },
        approval_levels: {
          select: { id: true, level: true, approver_id: true, status: true },
        },
      },
      orderBy: { due_date: "asc" },
    });

    const result = records.map((r) => {
      const currentLevelEntry = r.approval_levels.find(
        (al) => al.level === r.current_level
      );
      const can_act =
        r.status === "SUBMITTED" &&
        currentLevelEntry?.approver_id === user_id;

      return {
        id: r.id,
        name: r.name || r.template?.title || "—",
        template_name: r.template?.title ?? null,
        due_date: r.due_date,
        status: r.status,
        current_level: r.current_level,
        total_levels: r.template?.approval_levels ?? 1,
        is_overdue: r.status !== "APPROVED" && r.due_date < now,
        can_act,
        approval_level_id: can_act ? (currentLevelEntry?.id ?? null) : null,
        assigned_user_id: r.assigned_user_id ?? null,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

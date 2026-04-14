import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user_id, company_id, role } = auth.user;

  const now = new Date();

  try {
    /* ── USER: tasks assigned to them pending submission ── */
    if (role === "USER") {
      const records = await prisma.aMC.findMany({
        where: {
          company_id,
          assigned_user_id: user_id,
          status: { in: ["DRAFT", "PENDING", "REJECTED"] },
        },
        include: {
          amcTemplate: { select: { name: true, approval_levels: true } },
        },
        orderBy: { created_at: "desc" },
      });

      return NextResponse.json(
        records.map((r) => ({
          id:               r.id,
          name:             r.name || r.amcTemplate?.name || "—",
          template_name:    r.amcTemplate?.name ?? null,
          due_date:         r.due_date ?? r.expiry_date ?? r.created_at,
          status:           r.status,
          current_level:    r.current_level,
          total_levels:     r.amcTemplate?.approval_levels ?? 1,
          is_overdue:       r.status !== "APPROVED" && !!(r.due_date && r.due_date < now),
          assigned_user_id: r.assigned_user_id ?? null,
          can_act:          false,
          approval_level_id: null,
        }))
      );
    }

    /* ── APPROVER: approval levels pending their action ── */
    if (role === "APPROVER") {
      const levels = await prisma.aMCApprovalLevel.findMany({
        where: {
          approver_id: user_id,
          status:      "PENDING",
          amc:         { company_id, status: "SUBMITTED" },
        },
        include: {
          amc: {
            include: {
              amcTemplate: { select: { name: true, approval_levels: true } },
            },
          },
        },
        orderBy: { created_at: "desc" },
      });

      return NextResponse.json(
        levels.map((al) => {
          const a = al.amc;
          return {
            id:               a.id,
            name:             a.name || a.amcTemplate?.name || "—",
            template_name:    a.amcTemplate?.name ?? null,
            due_date:         a.due_date ?? a.expiry_date ?? a.created_at,
            status:           a.status,
            current_level:    a.current_level,
            total_levels:     a.amcTemplate?.approval_levels ?? 1,
            is_overdue:       a.status !== "APPROVED" && !!(a.due_date && a.due_date < now),
            assigned_user_id: a.assigned_user_id ?? null,
            can_act:          true,
            approval_level_id: al.id,
          };
        })
      );
    }

    /* ── ADMIN / MANAGER / others: no personal task queue ── */
    return NextResponse.json([]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

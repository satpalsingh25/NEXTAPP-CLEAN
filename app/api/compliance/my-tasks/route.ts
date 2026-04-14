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
      const records = await prisma.compliance.findMany({
        where: {
          company_id,
          assigned_user_id: user_id,
          status: { in: ["DRAFT", "PENDING", "REJECTED"] },
        },
        include: {
          template: { select: { title: true, approval_levels: true } },
        },
        orderBy: { created_at: "desc" },
      });

      return NextResponse.json(
        records.map((r) => ({
          id:               r.id,
          name:             r.name || r.template?.title || "—",
          template_name:    r.template?.title ?? null,
          due_date:         r.due_date ?? r.created_at,
          status:           r.status,
          current_level:    r.current_level,
          total_levels:     r.template?.approval_levels ?? 1,
          is_overdue:       r.status !== "APPROVED" && !!(r.due_date && r.due_date < now),
          assigned_user_id: r.assigned_user_id ?? null,
          can_act:          false,
          approval_level_id: null,
        }))
      );
    }

    /* ── APPROVER: approval levels pending their action ── */
    if (role === "APPROVER") {
      const levels = await prisma.complianceApprovalLevel.findMany({
        where: {
          approver_id: user_id,
          status:      "PENDING",
          compliance:  { company_id, status: "SUBMITTED" },
        },
        include: {
          compliance: {
            include: {
              template: { select: { title: true, approval_levels: true } },
            },
          },
        },
        orderBy: { created_at: "desc" },
      });

      return NextResponse.json(
        levels.map((al) => {
          const c = al.compliance;
          return {
            id:               c.id,
            name:             c.name || c.template?.title || "—",
            template_name:    c.template?.title ?? null,
            due_date:         c.due_date ?? c.created_at,
            status:           c.status,
            current_level:    c.current_level,
            total_levels:     c.template?.approval_levels ?? 1,
            is_overdue:       c.status !== "APPROVED" && !!(c.due_date && c.due_date < now),
            assigned_user_id: c.assigned_user_id ?? null,
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

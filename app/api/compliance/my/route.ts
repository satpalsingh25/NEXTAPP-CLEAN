import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user_id, company_id, role } = auth.user;

  try {
    const where =
      role === "SUPER_ADMIN"
        ? { assigned_user_id: user_id }
        : { assigned_user_id: user_id, company_id };

    const records = await prisma.compliance.findMany({
      where,
      select: {
        id: true,
        name: true,
        due_date: true,
        status: true,
        current_level: true,
        statusMaster: { select: { name: true } },
      },
      orderBy: { due_date: "asc" },
    });

    const now = new Date();

    const result = records.map((r) => {
      const rawStatus = r.statusMaster?.name ?? r.status;
      const isOverdue =
        r.due_date &&
        new Date(r.due_date) < now &&
        !["APPROVED", "REJECTED"].includes(rawStatus.toUpperCase());

      return {
        id: r.id,
        name: r.name,
        due_date: r.due_date,
        status: isOverdue ? "OVERDUE" : rawStatus,
        current_level: r.current_level,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

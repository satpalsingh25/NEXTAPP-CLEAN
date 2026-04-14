import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, role } = auth.user;

  try {
    const where = role === "SUPER_ADMIN" ? {} : { company_id };
    const amcs = await prisma.aMC.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        amcTemplate: {
          select: { id: true, name: true, approval_levels: true },
        },
        approval_levels: {
          select: { id: true, level: true, approver_id: true },
          orderBy: { level: "asc" },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(amcs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";

// Returns all compliance records (for the selector), each with their current
// approval matrix level count and template info.
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, role } = auth.user;

  try {
    const where = role === "SUPER_ADMIN" ? {} : { company_id };

    const records = await prisma.compliance.findMany({
      where,
      select: {
        id:        true,
        name:      true,
        title:     true,
        status:    true,
        template: {
          select: { id: true, title: true, approval_levels: true },
        },
        approval_levels: {
          select: { id: true, level: true, approver_id: true },
          orderBy: { level: "asc" },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(records);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

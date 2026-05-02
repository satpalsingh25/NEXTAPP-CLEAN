import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";

const GROUP_SELECT = {
  id: true,
  name: true,
  description: true,
  created_at: true,
  company: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true, email: true } },
  department: { select: { id: true, name: true } },
  businessFunction: { select: { id: true, name: true } },
  _count: { select: { users: true } },
};

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, role } = auth.user;

  try {
    const where = role === "SUPER_ADMIN" ? {} : { company_id };
    const data = await prisma.group.findMany({
      where,
      select: GROUP_SELECT,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  try {
    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const data = await prisma.group.create({
      data: {
        name: body.name.trim(),
        description: body.description || null,
        company_id: body.company_id || company_id,
        owner_id: body.owner_id || null,
        department_id: body.department_id || null,
        function_id: body.function_id || null,
      },
      select: GROUP_SELECT,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

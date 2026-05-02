import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";

const GROUP_DETAIL_SELECT = {
  id: true,
  name: true,
  description: true,
  created_at: true,
  company: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true, email: true, role: true } },
  department: { select: { id: true, name: true } },
  businessFunction: { select: { id: true, name: true } },
  users: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      is_active: true,
    },
    orderBy: { email: "asc" as const },
  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const group = await prisma.group.findUnique({
      where: { id },
      select: GROUP_DETAIL_SELECT,
    });
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    return NextResponse.json(group);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();

    if (body.name !== undefined && !body.name?.trim()) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }

    const group = await prisma.group.update({
      where: { id },
      data: {
        ...(body.name        !== undefined ? { name: body.name.trim() }        : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.company_id  !== undefined ? { company_id: body.company_id || null }  : {}),
        ...(body.owner_id    !== undefined ? { owner_id: body.owner_id || null }       : {}),
        ...(body.department_id !== undefined ? { department_id: body.department_id || null } : {}),
        ...(body.function_id   !== undefined ? { function_id: body.function_id || null }    : {}),
      },
      select: GROUP_DETAIL_SELECT,
    });
    return NextResponse.json(group);
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
  try {
    const { id } = await params;
    await prisma.user.updateMany({ where: { group_id: id }, data: { group_id: null } });
    await prisma.group.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

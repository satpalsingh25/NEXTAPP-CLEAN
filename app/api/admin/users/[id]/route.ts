import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  is_active: true,
  must_reset_password: true,
  created_at: true,
  company: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  businessFunction: { select: { id: true, name: true } },
  group: { select: { id: true, name: true } },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_SELECT,
        audit_logs: {
          orderBy: { timestamp: "desc" },
          take: 50,
          select: {
            id: true,
            action_type: true,
            module: true,
            record_id: true,
            old_value: true,
            new_value: true,
            ip_address: true,
            timestamp: true,
          },
        },
      },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
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

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name !== undefined   ? { name: body.name || null }             : {}),
        ...(body.email                ? { email: body.email }                   : {}),
        ...(body.role                 ? { role: body.role }                     : {}),
        ...(body.company_id           ? { company_id: body.company_id }         : {}),
        ...(body.department_id !== undefined ? { department_id: body.department_id || null } : {}),
        ...(body.function_id  !== undefined  ? { function_id: body.function_id  || null }  : {}),
        ...(body.group_id     !== undefined  ? { group_id: body.group_id        || null }  : {}),
      },
      select: USER_SELECT,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
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

    await prisma.auditLog.deleteMany({ where: { user_id: id } });
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

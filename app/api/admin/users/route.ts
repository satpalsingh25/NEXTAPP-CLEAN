import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";
import { logAudit } from "@/lib/audit-log";

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

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, role } = auth.user;
  try {
    const { searchParams } = new URL(req.url);
    const department_id = searchParams.get("department_id");

    const where: Record<string, unknown> = role === "SUPER_ADMIN" ? {} : { company_id };
    if (department_id) where.department_id = department_id;

    const users = await prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id: authCompanyId, role } = auth.user;
  try {
    const body = await req.json();

    if (!body.email || !body.password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    let company_id: string;
    if (role === "SUPER_ADMIN") {
      company_id = body.company_id;
      if (!company_id) {
        const fallback = await prisma.company.findFirst();
        if (!fallback) return NextResponse.json({ error: "No company found" }, { status: 500 });
        company_id = fallback.id;
      }
    } else {
      company_id = authCompanyId;
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name || null,
        password_hash: hashedPassword,
        role: body.role || "USER",
        company_id,
        is_active: true,
        must_reset_password: body.must_reset_password ?? false,
        department_id: body.department_id || null,
        function_id: body.function_id || null,
        group_id: body.group_id || null,
      },
      select: USER_SELECT,
    });

    void logAudit({ company_id, user_id: auth.user.user_id, action: "USER_CREATE", module: "ADMIN", entity_type: "user", entity_id: user.id, description: `Created user ${user.name || user.email}` });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

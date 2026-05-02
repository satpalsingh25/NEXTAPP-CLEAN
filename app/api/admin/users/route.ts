import { prisma }          from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt              from "bcryptjs";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";
import { logAudit }        from "@/lib/audit-log";
import { checkRateLimit }  from "@/lib/rate-limit";
import { validateEmail, validateRequiredString, validateOptionalString, ValidationError } from "@/lib/validation";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  is_active: true,
  must_reset_password: true,
  created_at: true,
  company:          { select: { id: true, name: true } },
  department:       { select: { id: true, name: true } },
  businessFunction: { select: { id: true, name: true } },
  group:            { select: { id: true, name: true } },
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
      select:  USER_SELECT,
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
  const { company_id: authCompanyId, role, user_id: actorId } = auth.user;

  /* Rate limit — 30 user-creates / 15 min */
  const rl = checkRateLimit(actorId, "admin-users-create", "write");
  if (rl) return rl;

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    /* Validate required fields */
    let email: string;
    let password: string;
    try {
      email    = validateEmail(body.email);
      password = validateRequiredString(body.password, 128, "Password");
      if (body.name !== undefined && body.name !== null && body.name !== "") {
        validateOptionalString(body.name, 255, "Name");
      }
    } catch (e) {
      if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }

    let company_id: string;
    if (role === "SUPER_ADMIN") {
      company_id = body.company_id as string;
      if (!company_id) {
        const fallback = await prisma.company.findFirst();
        if (!fallback) return NextResponse.json({ error: "No company found" }, { status: 500 });
        company_id = fallback.id;
      }
    } else {
      company_id = authCompanyId;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name:                body.name as string || null,
        password_hash:       hashedPassword,
        role:                (body.role as string) || "USER",
        company_id,
        is_active:           true,
        must_reset_password: (body.must_reset_password as boolean) ?? false,
        department_id:       (body.department_id as string) || null,
        function_id:         (body.function_id as string) || null,
        group_id:            (body.group_id as string) || null,
      },
      select: USER_SELECT,
    });

    void logAudit({ company_id, user_id: actorId, action: "USER_CREATE", module: "ADMIN", entity_type: "user", entity_id: user.id, description: `Created user ${user.name || user.email}` });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

import { prisma }          from "@/lib/prisma";
import { Prisma, Role }   from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";
import { logAudit }        from "@/lib/audit-log";
import { checkRateLimit }  from "@/lib/rate-limit";
import { validateUUID, validateEmail, validateOptionalString, ValidationError } from "@/lib/validation";
import { errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError } from "@/lib/error-log";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    try { validateUUID(id, "user id"); } catch (e) {
      if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json(user);
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: "GET /api/admin/users/[id]", user_id: auth.user.user_id, company_id: auth.user.company_id, request_id: requestId });
    return errorResponse("Something went wrong. Please try again.", 500, requestId);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  /* Rate limit — 50 updates / 15 min */
  const rl = checkRateLimit(auth.user.user_id, "admin-users-update", "write");
  if (rl) return rl;

  try {
    const { id } = await params;

    /* Validate route param */
    try { validateUUID(id, "user id"); } catch (e) {
      if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    /* Validate optional fields */
    try {
      if (body.email !== undefined)
        validateEmail(body.email);
      if (body.name !== undefined && body.name !== null && body.name !== "")
        validateOptionalString(body.name, 255, "Name");
    } catch (e) {
      if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }

    const updateData: Prisma.UserUncheckedUpdateInput = {};
    if (body.name        !== undefined) updateData.name          = (body.name as string) || null;
    if (body.email)                     updateData.email         = body.email as string;
    if (body.role)                      updateData.role          = body.role as Role;
    if (body.company_id)                updateData.company_id    = body.company_id as string;
    if (body.department_id !== undefined) updateData.department_id = (body.department_id as string) || null;
    if (body.function_id   !== undefined) updateData.function_id   = (body.function_id as string)   || null;
    if (body.group_id      !== undefined) updateData.group_id      = (body.group_id as string)      || null;

    const user = await prisma.user.update({
      where: { id },
      data:  updateData,
      select: USER_SELECT,
    });

    void logAudit({ company_id: auth.user.company_id, user_id: auth.user.user_id, action: "USER_UPDATE", module: "ADMIN", entity_type: "user", entity_id: user.id, description: `Updated user ${user.name || user.email}` });

    return NextResponse.json(user);
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: "PUT /api/admin/users/[id]", user_id: auth.user.user_id, company_id: auth.user.company_id, request_id: requestId });
    return errorResponse("Something went wrong. Please try again.", 500, requestId);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    try { validateUUID(id, "user id"); } catch (e) {
      if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    await prisma.auditLog.deleteMany({ where: { user_id: id } });
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: "DELETE /api/admin/users/[id]", user_id: auth.user.user_id, company_id: auth.user.company_id, request_id: requestId });
    return errorResponse("Something went wrong. Please try again.", 500, requestId);
  }
}

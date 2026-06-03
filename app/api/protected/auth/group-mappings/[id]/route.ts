import { NextRequest }             from "next/server";
import { prisma }                   from "@/lib/prisma";
import { requireRole, ADMIN_ONLY }  from "@/lib/auth.server";
import { errorResponse, successResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError }         from "@/lib/error-log";
import { logAudit }                 from "@/lib/audit-log";
import { validateUUID }             from "@/lib/validation";
import type { Role }                from "@prisma/client";

const VALID_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER", "CHECKER", "APPROVER", "USER", "CEO"];

type Params = { params: Promise<{ id: string }> };

/**
 * PUT /api/protected/auth/group-mappings/[id]
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const requestId = generateRequestId();

  const idErr = validateUUID(id, "id");
  if (idErr) return errorResponse(idErr, 400, requestId);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const existing = await prisma.identityGroupMapping.findFirst({
      where: { id, company_id: auth.user.company_id },
    });
    if (!existing) return errorResponse("Mapping not found.", 404, requestId);

    const appRole = body.app_role !== undefined
      ? (body.app_role ? String(body.app_role).trim() : null)
      : null;

    if (appRole && !VALID_ROLES.includes(appRole as Role)) {
      return errorResponse(`Invalid app_role: ${appRole}`, 400, requestId);
    }

    const updated = await prisma.identityGroupMapping.update({
      where: { id },
      data: {
        external_group_name: body.external_group_name
          ? String(body.external_group_name).trim()
          : existing.external_group_name,
        app_role:         body.app_role !== undefined
          ? ((appRole as Role) ?? null)
          : existing.app_role,
        auto_assign_role: body.auto_assign_role !== undefined
          ? Boolean(body.auto_assign_role)
          : existing.auto_assign_role,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled,
      },
    });

    void logAudit({
      company_id:  auth.user.company_id,
      user_id:     auth.user.user_id,
      action:      "GROUP_MAPPING_UPDATED",
      module:      "AUTH",
      entity_type: "identity_group_mapping",
      entity_id:   id,
      description: `Updated group mapping ${existing.external_group_name} → ${appRole ?? "no role"}`,
    });

    return successResponse(updated, 200);
  } catch (e) {
    logInternalError(e, {
      route:      `PUT /api/protected/auth/group-mappings/${id}`,
      company_id: auth.user.company_id,
      user_id:    auth.user.user_id,
      request_id: requestId,
    });
    return errorResponse("Failed to update group mapping.", 500, requestId);
  }
}

/**
 * PATCH /api/protected/auth/group-mappings/[id]
 * Toggle enabled / auto_assign_role.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const requestId = generateRequestId();

  const idErr = validateUUID(id, "id");
  if (idErr) return errorResponse(idErr, 400, requestId);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const existing = await prisma.identityGroupMapping.findFirst({
      where: { id, company_id: auth.user.company_id },
    });
    if (!existing) return errorResponse("Mapping not found.", 404, requestId);

    const data: Record<string, unknown> = {};
    if (body.enabled          !== undefined) data.enabled          = Boolean(body.enabled);
    if (body.auto_assign_role !== undefined) data.auto_assign_role = Boolean(body.auto_assign_role);

    const updated = await prisma.identityGroupMapping.update({ where: { id }, data });

    void logAudit({
      company_id:  auth.user.company_id,
      user_id:     auth.user.user_id,
      action:      "GROUP_MAPPING_TOGGLED",
      module:      "AUTH",
      entity_type: "identity_group_mapping",
      entity_id:   id,
      description: `Toggled group mapping ${existing.external_group_name}`,
    });

    return successResponse(updated, 200);
  } catch (e) {
    logInternalError(e, {
      route:      `PATCH /api/protected/auth/group-mappings/${id}`,
      company_id: auth.user.company_id,
      user_id:    auth.user.user_id,
      request_id: requestId,
    });
    return errorResponse("Failed to update group mapping.", 500, requestId);
  }
}

import { NextRequest }             from "next/server";
import { prisma }                   from "@/lib/prisma";
import { requireRole, ADMIN_ONLY }  from "@/lib/auth.server";
import { errorResponse, successResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError }         from "@/lib/error-log";
import { logAudit }                 from "@/lib/audit-log";
import { validateRequiredString, validateUUID } from "@/lib/validation";
import type { Role }                from "@prisma/client";

const VALID_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER", "CHECKER", "APPROVER", "USER", "CEO"];

/**
 * GET /api/protected/auth/group-mappings
 * Query: ?provider_id=<uuid>  (optional)
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  const requestId = generateRequestId();

  try {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get("provider_id");

    const mappings = await prisma.identityGroupMapping.findMany({
      where: {
        company_id: auth.user.company_id,
        ...(providerId ? { identity_provider_id: providerId } : {}),
      },
      orderBy: { created_at: "desc" },
      select: {
        id:                   true,
        identity_provider_id: true,
        external_group_id:    true,
        external_group_name:  true,
        app_role:             true,
        auto_assign_role:     true,
        enabled:              true,
        created_at:           true,
        updated_at:           true,
        identity_provider: {
          select: { id: true, name: true, provider_type: true },
        },
      },
    });

    return successResponse(mappings, 200);
  } catch (e) {
    logInternalError(e, {
      route:      "GET /api/protected/auth/group-mappings",
      company_id: auth.user.company_id,
      request_id: requestId,
    });
    return errorResponse("Failed to load group mappings.", 500, requestId);
  }
}

/**
 * POST /api/protected/auth/group-mappings
 */
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  const requestId = generateRequestId();

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const providerId = String(body.identity_provider_id ?? "").trim();
    const groupId    = String(body.external_group_id    ?? "").trim();
    const groupName  = String(body.external_group_name  ?? "").trim();
    const appRole    = body.app_role ? String(body.app_role).trim() : null;

    const pidErr = validateUUID(providerId, "identity_provider_id");
    if (pidErr) return errorResponse(pidErr, 400, requestId);
    if (!groupId)   return errorResponse("external_group_id is required.",   400, requestId);
    if (!groupName) return errorResponse("external_group_name is required.", 400, requestId);
    if (groupId.length   > 200) return errorResponse("external_group_id must be 200 characters or fewer.",   400, requestId);
    if (groupName.length > 200) return errorResponse("external_group_name must be 200 characters or fewer.", 400, requestId);
    if (appRole && !VALID_ROLES.includes(appRole as Role)) {
      return errorResponse(`Invalid app_role: ${appRole}`, 400, requestId);
    }

    const provider = await prisma.identityProvider.findFirst({
      where: { id: providerId, company_id: auth.user.company_id },
    });
    if (!provider) return errorResponse("Identity provider not found.", 404, requestId);

    const mapping = await prisma.identityGroupMapping.create({
      data: {
        company_id:           auth.user.company_id,
        identity_provider_id: providerId,
        external_group_id:    groupId,
        external_group_name:  groupName,
        app_role:             (appRole as Role) ?? null,
        auto_assign_role:     body.auto_assign_role !== false,
        enabled:              body.enabled !== false,
      },
    });

    void logAudit({
      company_id:  auth.user.company_id,
      user_id:     auth.user.user_id,
      action:      "GROUP_MAPPING_CREATED",
      module:      "AUTH",
      entity_type: "identity_group_mapping",
      entity_id:   mapping.id,
      description: `Created group mapping: ${groupName} → ${appRole ?? "no role"}`,
    });

    return successResponse(mapping, 201);
  } catch (e) {
    logInternalError(e, {
      route:      "POST /api/protected/auth/group-mappings",
      company_id: auth.user.company_id,
      user_id:    auth.user.user_id,
      request_id: requestId,
    });
    return errorResponse("Failed to create group mapping.", 500, requestId);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma }                      from "@/lib/prisma";
import { requireRole, ADMIN_ONLY }     from "@/lib/auth.server";
import {
  errorResponse, successResponse, generateRequestId,
} from "@/lib/api-response";
import { logInternalError }            from "@/lib/error-log";
import { validateRequiredString }      from "@/lib/validation";
import { testProviderConnection }      from "@/lib/storage/storage-service";

const SAFE_SELECT = {
  id: true, company_id: true, provider_type: true, name: true,
  enabled: true, is_default: true, configuration_json: true,
  provider_identifier: true, created_at: true, updated_at: true,
} as const;

/* PUT — update an existing storage provider */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;
  const { id } = await params;

  try {
    const existing = await prisma.storageProvider.findFirst({
      where: { id, company_id },
    });
    if (!existing) return errorResponse("Storage provider not found.", 404, requestId);

    const body = await req.json();
    const { name, configuration_json, provider_identifier, is_default, enabled } = body;

    if (name !== undefined) validateRequiredString(name, 255, "Name");

    if (is_default === true && !existing.is_default) {
      await prisma.storageProvider.updateMany({
        where: { company_id, is_default: true },
        data:  { is_default: false },
      });
    }

    const updated = await prisma.storageProvider.update({
      where: { id },
      data: {
        name:               name?.trim()              ?? existing.name,
        configuration_json: configuration_json        ?? existing.configuration_json,
        provider_identifier: provider_identifier !== undefined
          ? (provider_identifier?.trim() || null)
          : existing.provider_identifier,
        is_default: is_default !== undefined ? is_default : existing.is_default,
        enabled:    enabled    !== undefined ? enabled    : existing.enabled,
      },
      select: SAFE_SELECT,
    });

    const action =
      enabled === false && existing.enabled         ? "STORAGE_PROVIDER_DISABLE"
      : is_default === true && !existing.is_default ? "STORAGE_PROVIDER_SET_DEFAULT"
      : "STORAGE_PROVIDER_UPDATE";

    await prisma.auditLog.create({
      data: {
        company_id,
        user_id,
        action,
        module:      "STORAGE",
        entity_type: "StorageProvider",
        entity_id:   id,
        description: `Updated storage provider: ${updated.name}`,
      },
    });

    return successResponse(updated);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Validation")) {
      return errorResponse(err.message, 400, requestId);
    }
    logInternalError(err, { route: `PUT /api/protected/storage/providers/${id}`, user_id, company_id, request_id: requestId });
    return errorResponse("Failed to update storage provider.", 500, requestId);
  }
}

/* POST — test connection */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;
  const { id } = await params;

  try {
    const result = await testProviderConnection(id, company_id);
    return successResponse(result);
  } catch (err) {
    logInternalError(err, { route: `POST /api/protected/storage/providers/${id}`, user_id: auth.user.user_id, company_id, request_id: requestId });
    return errorResponse("Connection test failed.", 500, requestId);
  }
}

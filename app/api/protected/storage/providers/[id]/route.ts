import { NextRequest, NextResponse } from "next/server";
import { prisma }                      from "@/lib/prisma";
import { requireRole, ADMIN_ONLY }     from "@/lib/auth.server";
import {
  errorResponse, successResponse, generateRequestId,
} from "@/lib/api-response";
import { logInternalError }            from "@/lib/error-log";
import { validateRequiredString }      from "@/lib/validation";
import { testProviderConnection }      from "@/lib/storage/storage-service";
import { encryptPassword }             from "@/lib/smtp-crypto";

type RawProvider = {
  id: string; company_id: string; provider_type: string; name: string;
  enabled: boolean; is_default: boolean; configuration_json: unknown;
  provider_identifier: string | null; created_at: Date; updated_at: Date;
};

function sanitizeGDConfig(p: RawProvider) {
  if (p.provider_type !== "GOOGLE_DRIVE" || !p.configuration_json) return p;
  const {
    client_secret_enc: _cs,
    refresh_token_enc: _rt,
    ...safe
  } = p.configuration_json as Record<string, unknown>;
  return {
    ...p,
    configuration_json: { ...safe, has_secret: !!_cs, has_refresh_token: !!_rt },
  };
}

function encryptGDCredentials(
  providerType: string,
  incoming:     Record<string, unknown> | null | undefined,
  existing:     Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  if (providerType !== "GOOGLE_DRIVE" || !incoming) return incoming ?? undefined;
  const { client_secret, refresh_token, ...rest } = incoming;
  const out: Record<string, unknown> = { ...rest };
  if (typeof client_secret === "string" && client_secret) {
    out.client_secret_enc = encryptPassword(client_secret);
  } else if (existing?.client_secret_enc) {
    out.client_secret_enc = existing.client_secret_enc;
  }
  if (existing?.refresh_token_enc && !out.refresh_token_enc) {
    out.refresh_token_enc = existing.refresh_token_enc;
  }
  if (typeof refresh_token === "string" && refresh_token) {
    out.refresh_token_enc = encryptPassword(refresh_token);
  }
  return out;
}

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
        configuration_json: (encryptGDCredentials(
          existing.provider_type,
          configuration_json !== undefined ? configuration_json : null,
          existing.configuration_json as Record<string, unknown> | null,
        ) ?? existing.configuration_json) as never,
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

    return successResponse(sanitizeGDConfig(updated as RawProvider));
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

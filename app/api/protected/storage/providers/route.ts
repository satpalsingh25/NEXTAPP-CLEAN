import { NextRequest, NextResponse } from "next/server";
import { prisma }                      from "@/lib/prisma";
import { Prisma }                      from "@prisma/client";
import { requireRole, ADMIN_ONLY }     from "@/lib/auth.server";
import {
  errorResponse, successResponse, generateRequestId,
} from "@/lib/api-response";
import { logInternalError }            from "@/lib/error-log";
import { validateRequiredString }      from "@/lib/validation";
import { encryptPassword }             from "@/lib/smtp-crypto";

/* ── Helpers for Google Drive credential handling ──────────────────── */

type RawProvider = {
  id: string; company_id: string; provider_type: string; name: string;
  enabled: boolean; is_default: boolean; configuration_json: unknown;
  provider_identifier: string | null; created_at: Date; updated_at: Date;
};

/**
 * Strips encrypted Google Drive secrets from the JSON returned to clients.
 * Replaces them with boolean indicators (has_secret, has_refresh_token).
 */
function sanitizeGDConfig(p: RawProvider) {
  if (p.provider_type !== "GOOGLE_DRIVE" || !p.configuration_json) return p;
  const {
    client_secret_enc: _cs,
    refresh_token_enc: _rt,
    ...safe
  } = p.configuration_json as Record<string, unknown>;
  return {
    ...p,
    configuration_json: {
      ...safe,
      has_secret:        !!_cs,
      has_refresh_token: !!_rt,
    },
  };
}

/**
 * Encrypts plain-text Google Drive credentials before storing in configuration_json.
 * Preserves existing encrypted values when the caller omits plain-text fields.
 */
function encryptGDCredentials(
  providerType:   string,
  incoming:       Record<string, unknown> | null | undefined,
  existing:       Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | undefined {
  if (providerType !== "GOOGLE_DRIVE" || !incoming) {
    return incoming != null ? (incoming as Prisma.InputJsonValue) : undefined;
  }

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

  return out as Prisma.InputJsonValue;
}

const SAFE_SELECT = {
  id: true, company_id: true, provider_type: true, name: true,
  enabled: true, is_default: true, configuration_json: true,
  provider_identifier: true, created_at: true, updated_at: true,
} as const;

/* GET — list all storage providers for the caller's company */
export async function GET(req: NextRequest) {
  const requestId = generateRequestId();
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  try {
    const providers = await prisma.storageProvider.findMany({
      where:   { company_id },
      select:  SAFE_SELECT,
      orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
    });
    return successResponse(providers.map(sanitizeGDConfig));
  } catch (err) {
    logInternalError(err, { route: "GET /api/protected/storage/providers", user_id, company_id, request_id: requestId });
    return errorResponse("Failed to load storage providers.", 500, requestId);
  }
}

/* POST — create a new storage provider */
export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  try {
    const body = await req.json();
    const { name, provider_type, configuration_json, provider_identifier, is_default } = body;

    validateRequiredString(name,          255, "Name");
    validateRequiredString(provider_type,  50, "Provider type");

    const validTypes = ["SHAREPOINT", "GOOGLE_DRIVE", "AWS_S3", "AZURE_BLOB"];
    if (!validTypes.includes(provider_type)) {
      return errorResponse(`Invalid provider type. Must be one of: ${validTypes.join(", ")}`, 400, requestId);
    }

    if (is_default) {
      await prisma.storageProvider.updateMany({
        where: { company_id, is_default: true },
        data:  { is_default: false },
      });
    }

    const provider = await prisma.storageProvider.create({
      data: {
        company_id,
        name:               name.trim(),
        provider_type,
        configuration_json: encryptGDCredentials(provider_type, configuration_json, null),
        provider_identifier: provider_identifier?.trim() || null,
        is_default:         is_default ?? false,
        enabled:            true,
      },
      select: SAFE_SELECT,
    });

    await prisma.auditLog.create({
      data: {
        company_id,
        user_id,
        action:      "STORAGE_PROVIDER_CREATE",
        module:      "STORAGE",
        entity_type: "StorageProvider",
        entity_id:   provider.id,
        description: `Created storage provider: ${provider.name} (${provider.provider_type})`,
      },
    });

    return successResponse(sanitizeGDConfig(provider as RawProvider), 201);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Validation")) {
      return errorResponse(err.message, 400, requestId);
    }
    logInternalError(err, { route: "POST /api/protected/storage/providers", user_id, company_id, request_id: requestId });
    return errorResponse("Failed to create storage provider.", 500, requestId);
  }
}

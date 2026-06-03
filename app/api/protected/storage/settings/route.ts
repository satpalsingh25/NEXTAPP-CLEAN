import { NextRequest, NextResponse } from "next/server";
import { prisma }                      from "@/lib/prisma";
import { requireRole, ADMIN_ONLY }     from "@/lib/auth.server";
import {
  errorResponse, successResponse, generateRequestId,
} from "@/lib/api-response";
import { logInternalError }            from "@/lib/error-log";

/* GET — fetch company storage settings (upsert if missing) */
export async function GET(req: NextRequest) {
  const requestId = generateRequestId();
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  try {
    const settings = await prisma.companyStorageSettings.upsert({
      where:  { company_id },
      create: {
        company_id,
        auto_create_folder_structure: true,
        enable_external_sharing:      false,
      },
      update: {},
      select: {
        id: true, company_id: true, default_provider_id: true,
        auto_create_folder_structure: true, enable_external_sharing: true,
        created_at: true, updated_at: true,
      },
    });
    return successResponse(settings);
  } catch (err) {
    logInternalError(err, { route: "GET /api/protected/storage/settings", user_id, company_id, request_id: requestId });
    return errorResponse("Failed to load storage settings.", 500, requestId);
  }
}

/* PUT — update company storage settings */
export async function PUT(req: NextRequest) {
  const requestId = generateRequestId();
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  try {
    const body = await req.json();
    const { default_provider_id, auto_create_folder_structure, enable_external_sharing } = body;

    if (default_provider_id) {
      const prov = await prisma.storageProvider.findFirst({
        where:  { id: default_provider_id, company_id },
        select: { id: true },
      });
      if (!prov) return errorResponse("Default provider not found or not accessible.", 400, requestId);
    }

    const settings = await prisma.companyStorageSettings.upsert({
      where:  { company_id },
      create: {
        company_id,
        default_provider_id:          default_provider_id ?? null,
        auto_create_folder_structure: auto_create_folder_structure ?? true,
        enable_external_sharing:      enable_external_sharing ?? false,
      },
      update: {
        default_provider_id: default_provider_id !== undefined
          ? (default_provider_id || null)
          : undefined,
        auto_create_folder_structure: auto_create_folder_structure !== undefined
          ? auto_create_folder_structure : undefined,
        enable_external_sharing: enable_external_sharing !== undefined
          ? enable_external_sharing : undefined,
      },
      select: {
        id: true, company_id: true, default_provider_id: true,
        auto_create_folder_structure: true, enable_external_sharing: true,
        created_at: true, updated_at: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        company_id,
        user_id,
        action:      "STORAGE_SETTINGS_UPDATE",
        module:      "STORAGE",
        entity_type: "CompanyStorageSettings",
        entity_id:   settings.id,
        description: "Updated company storage settings.",
      },
    });

    return successResponse(settings);
  } catch (err) {
    logInternalError(err, { route: "PUT /api/protected/storage/settings", user_id, company_id, request_id: requestId });
    return errorResponse("Failed to update storage settings.", 500, requestId);
  }
}

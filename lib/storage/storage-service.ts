import { prisma }              from "@/lib/prisma";
import { getDriveId, getSharePointToken } from "@/lib/sharepoint-check";
import type { StorageProviderConfig, StorageProviderKind, TestConnectionResult } from "./types";
import { getStorageProvider }  from "./factory";
import { SharePointStorageProvider } from "./providers/sharepoint-provider";
import { GoogleDriveStorageProvider } from "./providers/google-drive-provider";

/* ── resolveCompanyStorageProvider ──────────────────────────────────── */
export async function resolveCompanyStorageProvider(
  companyId: string,
  providerId?: string,
): Promise<StorageProviderConfig | null> {
  if (providerId) {
    const p = await prisma.storageProvider.findFirst({
      where: { id: providerId, company_id: companyId, enabled: true },
    });
    if (!p) return null;
    return toConfig(p);
  }
  return getDefaultStorageProvider(companyId);
}

/* ── getDefaultStorageProvider ──────────────────────────────────────── */
export async function getDefaultStorageProvider(
  companyId: string,
): Promise<StorageProviderConfig | null> {
  const p = await prisma.storageProvider.findFirst({
    where:   { company_id: companyId, is_default: true, enabled: true },
    orderBy: { created_at: "asc" },
  });
  if (!p) return null;
  return toConfig(p);
}

/* ── validateProviderOwnership ──────────────────────────────────────── */
export async function validateProviderOwnership(
  providerId: string,
  companyId:  string,
): Promise<boolean> {
  const p = await prisma.storageProvider.findFirst({
    where:  { id: providerId, company_id: companyId },
    select: { id: true },
  });
  return p !== null;
}

/* ── resolveSharePointProvider ──────────────────────────────────────── */
/**
 * Returns the enabled SHAREPOINT provider for the company, auto-creating one
 * from the existing SharePointConfig if none exists yet.
 */
export async function resolveSharePointProvider(
  companyId: string,
): Promise<StorageProviderConfig | null> {
  const existing = await prisma.storageProvider.findFirst({
    where:   { company_id: companyId, provider_type: "SHAREPOINT", enabled: true },
    orderBy: { is_default: "desc" },
  });
  if (existing) return toConfig(existing);

  return ensureSharePointProviderRegistered(companyId);
}

/* ── getSharePointProviderId ────────────────────────────────────────── */
export async function getSharePointProviderId(
  companyId: string,
): Promise<string | null> {
  const config = await resolveSharePointProvider(companyId);
  return config?.id ?? null;
}

/* ── ensureSharePointProviderRegistered ─────────────────────────────── */
export async function ensureSharePointProviderRegistered(
  companyId: string,
): Promise<StorageProviderConfig | null> {
  const spConfig = await prisma.sharePointConfig.findUnique({
    where:  { company_id: companyId },
    select: { id: true, site_url: true },
  });
  if (!spConfig) return null;

  const alreadyExists = await prisma.storageProvider.findFirst({
    where:  { company_id: companyId, provider_type: "SHAREPOINT" },
    select: { id: true },
  });
  if (alreadyExists) return toConfig(await prisma.storageProvider.findFirst({
    where: { company_id: companyId, provider_type: "SHAREPOINT", enabled: true },
    orderBy: { is_default: "desc" },
  }) ?? alreadyExists as never);

  const created = await prisma.storageProvider.create({
    data: {
      company_id:          companyId,
      name:                "SharePoint",
      provider_type:       "SHAREPOINT",
      enabled:             true,
      is_default:          true,
      configuration_json:  {
        linked_sharepoint_config: true,
        site_url_preview:         spConfig.site_url,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      company_id,
      action:      "STORAGE_PROVIDER_AUTO_CREATE",
      module:      "STORAGE",
      entity_type: "StorageProvider",
      entity_id:   created.id,
      description: "Auto-created SharePoint storage provider from existing SharePoint configuration.",
    },
  });

  return toConfig(created);
}

/* ── getSharePointProviderInstance ──────────────────────────────────── */
export async function getSharePointProviderInstance(
  companyId: string,
): Promise<SharePointStorageProvider | null> {
  const config = await resolveSharePointProvider(companyId);
  if (!config) return null;
  return new SharePointStorageProvider(config);
}

/* ── uploadDmsFile ──────────────────────────────────────────────────── */
/**
 * Uploads a file via the company's default storage provider.
 * Routes to Google Drive or SharePoint depending on what is configured.
 * Returns the fields needed to create a DmsDocument record.
 */
export async function uploadDmsFile(params: {
  companyId:  string;
  folderPath: string;   // e.g. "Company/Acme_Ltd/users/abc123"
  fileName:   string;
  file:       File;
}): Promise<{
  fileId:               string;
  webUrl:               string;
  driveId:              string;   // Graph drive ID (SP) or Shared Drive ID (GD)
  filePath:             string;
  storage_provider_id:  string | null;
}> {
  const { companyId, folderPath, fileName, file } = params;

  /* ── Check if a non-SharePoint default provider is configured ──── */
  const defaultProvider = await getDefaultStorageProvider(companyId);

  if (defaultProvider?.provider_type === "GOOGLE_DRIVE") {
    const provider = new GoogleDriveStorageProvider(defaultProvider);
    const buffer   = Buffer.from(await file.arrayBuffer());
    const result   = await provider.uploadFile({
      buffer,
      fileName,
      mimeType:   file.type || "application/octet-stream",
      folderPath,
      companyId,
    });

    const cfg           = (defaultProvider.configuration_json ?? {}) as Record<string, unknown>;
    const sharedDriveId = cfg.use_shared_drive && cfg.drive_id
      ? String(cfg.drive_id)
      : "";

    return {
      fileId:              result.fileId,
      webUrl:              result.webUrl ?? "",
      driveId:             sharedDriveId,
      filePath:            result.filePath,
      storage_provider_id: defaultProvider.id,
    };
  }

  /* ── Fallback: SharePoint (existing logic) ──────────────────────── */
  const [driveId, token] = await Promise.all([
    getDriveId(companyId),
    getSharePointToken(companyId),
  ]);

  const cleanPath = folderPath.replace(/^\/+|\/+$/g, "");
  const uploadUrl =
    `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${cleanPath}/${encodeURIComponent(fileName)}:/content`;

  const arrayBuffer = await file.arrayBuffer();

  const spRes = await fetch(uploadUrl, {
    method:  "PUT",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body: arrayBuffer,
  });

  if (!spRes.ok) {
    const errJson = await spRes.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(
      `SharePoint upload failed for "${fileName}": ${errJson?.error?.message ?? spRes.statusText}`,
    );
  }

  const spFile       = await spRes.json() as { id?: string; webUrl?: string };
  const spProviderId = await getSharePointProviderId(companyId).catch(() => null);

  return {
    fileId:              spFile.id   ?? "",
    webUrl:              spFile.webUrl ?? uploadUrl,
    driveId,
    filePath:            `/${cleanPath}/${fileName}`,
    storage_provider_id: spProviderId,
  };
}

/* ── downloadFileFromProvider ───────────────────────────────────────── */
/**
 * Downloads a file via a non-SharePoint storage provider.
 * Returns null if the provider is SharePoint or not set
 * (callers should fall through to their existing SharePoint logic).
 *
 * Accepts either `sharepoint_item_id` (DmsDocument) or
 * `external_file_id` (Document / Compliance / AMC) as the file ID.
 */
export async function downloadFileFromProvider(
  companyId:   string,
  doc: {
    storage_provider_id?: string | null;
    sharepoint_item_id?:  string | null;  // DmsDocument field
    external_file_id?:    string | null;  // Document (Compliance/AMC) field
  },
  filePath?: string,
): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | null> {
  if (!doc.storage_provider_id) return null;

  const config = await resolveCompanyStorageProvider(
    companyId, doc.storage_provider_id,
  ).catch(() => null);
  if (!config || config.provider_type === "SHAREPOINT") return null;

  const fileId   = doc.sharepoint_item_id ?? doc.external_file_id ?? "";
  const provider = getStorageProvider(config);
  return provider.downloadFile(fileId, filePath);
}

/* ── deleteFileFromProvider ─────────────────────────────────────────── */
/**
 * Deletes a file via a non-SharePoint storage provider (best-effort).
 * Returns true if deletion was attempted, false if caller should use SharePoint.
 *
 * Accepts either `sharepoint_item_id` (DmsDocument) or
 * `external_file_id` (Document / Compliance / AMC) as the file ID.
 */
export async function deleteFileFromProvider(
  companyId: string,
  doc: {
    storage_provider_id?: string | null;
    sharepoint_item_id?:  string | null;
    external_file_id?:    string | null;
  },
): Promise<boolean> {
  if (!doc.storage_provider_id) return false;

  const config = await resolveCompanyStorageProvider(
    companyId, doc.storage_provider_id,
  ).catch(() => null);
  if (!config || config.provider_type === "SHAREPOINT") return false;

  const fileId = doc.sharepoint_item_id ?? doc.external_file_id ?? "";
  try {
    const provider = getStorageProvider(config);
    await provider.deleteFile(fileId);
  } catch (err) {
    console.error("[storage-service] deleteFileFromProvider error (non-blocking):", err);
  }
  return true;
}

/* ── testProviderConnection ─────────────────────────────────────────── */
export async function testProviderConnection(
  providerId: string,
  companyId:  string,
): Promise<TestConnectionResult> {
  const config = await resolveCompanyStorageProvider(companyId, providerId);
  if (!config) {
    return { ok: false, message: "Provider not found or not accessible." };
  }
  const provider = getStorageProvider(config);
  if (!provider.testConnection) {
    return { ok: true, message: "Provider registered. No connection test available for this type." };
  }
  return provider.testConnection();
}

/* ── internal helpers ───────────────────────────────────────────────── */
function toConfig(
  p: {
    id: string; name: string; provider_type: string;
    configuration_json: unknown; provider_identifier: string | null;
    enabled: boolean; is_default: boolean; company_id: string;
  },
): StorageProviderConfig {
  return {
    id:                  p.id,
    name:                p.name,
    provider_type:       p.provider_type as StorageProviderKind,
    configuration_json:  p.configuration_json as Record<string, unknown> | null,
    provider_identifier: p.provider_identifier,
    enabled:             p.enabled,
    is_default:          p.is_default,
    company_id:          p.company_id,
  };
}

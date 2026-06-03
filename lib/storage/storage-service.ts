import { prisma }              from "@/lib/prisma";
import { getDriveId, getSharePointToken } from "@/lib/sharepoint-check";
import type { StorageProviderConfig, StorageProviderKind, TestConnectionResult } from "./types";
import { getStorageProvider }  from "./factory";
import { SharePointStorageProvider } from "./providers/sharepoint-provider";

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
  /* 1. Look for an existing SHAREPOINT entry */
  const existing = await prisma.storageProvider.findFirst({
    where:   { company_id: companyId, provider_type: "SHAREPOINT", enabled: true },
    orderBy: { is_default: "desc" },
  });
  if (existing) return toConfig(existing);

  /* 2. Auto-migrate from SharePointConfig if configured */
  return ensureSharePointProviderRegistered(companyId);
}

/* ── getSharePointProviderId ────────────────────────────────────────── */
/**
 * Returns just the ID of the SHAREPOINT provider (for FK storage on Document),
 * creating the provider entry if needed.
 */
export async function getSharePointProviderId(
  companyId: string,
): Promise<string | null> {
  const config = await resolveSharePointProvider(companyId);
  return config?.id ?? null;
}

/* ── ensureSharePointProviderRegistered ─────────────────────────────── */
/**
 * If a SharePointConfig row exists for the company but no StorageProvider entry
 * of type SHAREPOINT, auto-creates one as a registry entry (credentials stay
 * in the existing SharePointConfig table — never duplicated here).
 */
export async function ensureSharePointProviderRegistered(
  companyId: string,
): Promise<StorageProviderConfig | null> {
  /* Check for existing SharePointConfig */
  const spConfig = await prisma.sharePointConfig.findUnique({
    where:  { company_id: companyId },
    select: { id: true, site_url: true },
  });
  if (!spConfig) return null; // SharePoint not configured at all

  /* Already has a StorageProvider entry? */
  const alreadyExists = await prisma.storageProvider.findFirst({
    where:  { company_id: companyId, provider_type: "SHAREPOINT" },
    select: { id: true },
  });
  if (alreadyExists) return toConfig(await prisma.storageProvider.findFirst({
    where: { company_id: companyId, provider_type: "SHAREPOINT", enabled: true },
    orderBy: { is_default: "desc" },
  }) ?? alreadyExists as never);

  /* Auto-create */
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
      company_id:  companyId,
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
/**
 * Returns a ready-to-use SharePointStorageProvider for the given company.
 * Returns null if SharePoint is not configured for this company.
 */
export async function getSharePointProviderInstance(
  companyId: string,
): Promise<SharePointStorageProvider | null> {
  const config = await resolveSharePointProvider(companyId);
  if (!config) return null;
  return new SharePointStorageProvider(config);
}

/* ── uploadDmsFile ──────────────────────────────────────────────────── */
/**
 * Uploads a single file to SharePoint via the provider interface.
 * Used by the DMS upload route so it goes through the storage abstraction.
 *
 * Returns the SharePoint item ID, web URL, drive ID, and full logical path
 * — all the fields the DmsDocument creation needs.
 */
export async function uploadDmsFile(params: {
  companyId:  string;
  folderPath: string;   // e.g. "Company/Acme_Ltd/users/abc123"
  fileName:   string;
  file:       File;
}): Promise<{
  fileId:   string;
  webUrl:   string;
  driveId:  string;
  filePath: string;
}> {
  const { companyId, folderPath, fileName, file } = params;

  /* Resolve SharePoint token + drive in parallel */
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

  const spFile = await spRes.json() as { id?: string; webUrl?: string };
  return {
    fileId:   spFile.id   ?? "",
    webUrl:   spFile.webUrl ?? uploadUrl,
    driveId,
    filePath: `/${cleanPath}/${fileName}`,
  };
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

/* ── internal helper ────────────────────────────────────────────────── */
function toConfig(
  p: {
    id: string; name: string; provider_type: string;
    configuration_json: unknown; provider_identifier: string | null;
    enabled: boolean; is_default: boolean; company_id: string;
  },
): StorageProviderConfig {
  return {
    id:                 p.id,
    name:               p.name,
    provider_type:      p.provider_type as StorageProviderKind,
    configuration_json: p.configuration_json as Record<string, unknown> | null,
    provider_identifier: p.provider_identifier,
    enabled:            p.enabled,
    is_default:         p.is_default,
    company_id:         p.company_id,
  };
}

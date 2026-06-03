import { prisma } from "@/lib/prisma";
import type { StorageProviderConfig, StorageProviderKind, TestConnectionResult } from "./types";
import { getStorageProvider } from "./factory";

export async function resolveCompanyStorageProvider(
  companyId: string,
  providerId?: string,
): Promise<StorageProviderConfig | null> {
  if (providerId) {
    const p = await prisma.storageProvider.findFirst({
      where: { id: providerId, company_id: companyId, enabled: true },
    });
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      provider_type: p.provider_type as StorageProviderKind,
      configuration_json: p.configuration_json as Record<string, unknown> | null,
      provider_identifier: p.provider_identifier,
      enabled: p.enabled,
      is_default: p.is_default,
      company_id: p.company_id,
    };
  }
  return getDefaultStorageProvider(companyId);
}

export async function getDefaultStorageProvider(
  companyId: string,
): Promise<StorageProviderConfig | null> {
  const p = await prisma.storageProvider.findFirst({
    where: { company_id: companyId, is_default: true, enabled: true },
  });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    provider_type: p.provider_type as StorageProviderKind,
    configuration_json: p.configuration_json as Record<string, unknown> | null,
    provider_identifier: p.provider_identifier,
    enabled: p.enabled,
    is_default: p.is_default,
    company_id: p.company_id,
  };
}

export async function validateProviderOwnership(
  providerId: string,
  companyId: string,
): Promise<boolean> {
  const p = await prisma.storageProvider.findFirst({
    where: { id: providerId, company_id: companyId },
    select: { id: true },
  });
  return p !== null;
}

export async function testProviderConnection(
  providerId: string,
  companyId: string,
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

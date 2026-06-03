/**
 * Azure AD user import and group sync service.
 *
 * Rules enforced:
 *   - Never delete users
 *   - Never overwrite passwords
 *   - Never modify LOCAL users' auth_provider
 *   - Auto-create only if company allows auto_import_external_users
 *   - Group IDs stored on user; role applied only if mapping has auto_assign_role=true
 */
import { prisma }                    from "@/lib/prisma";
import { fetchAzureUsers, fetchAzureGroups, fetchGroupMembers } from "./graph";
import { logAudit }                  from "@/lib/audit-log";
import type { Role }                 from "@prisma/client";

/* ── Result types ───────────────────────────────────────────────────── */
export interface ImportUsersResult {
  imported: number;
  updated:  number;
  skipped:  number;
  errors:   string[];
}

export interface SyncGroupsResult {
  synced:       number;
  usersMapped:  number;
  errors:       string[];
}

/* ── Import Azure users into the application ────────────────────────── */
export async function syncAzureUsers(
  providerId: string,
  companyId:  string,
  actorId:    string,
): Promise<ImportUsersResult> {
  const result: ImportUsersResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

  /* Load provider config */
  const provider = await prisma.identityProvider.findFirst({
    where: { id: providerId, company_id: companyId, provider_type: "AZURE_AD", enabled: true },
  });

  if (!provider?.client_id || !provider.client_secret || !provider.tenant_id) {
    throw new Error("Azure AD provider not found or missing credentials.");
  }

  /* Load company auth settings */
  const authSettings = await prisma.companyAuthSettings.findUnique({
    where: { company_id: companyId },
  });

  /* Load active group mappings for role assignment */
  const groupMappings = await prisma.identityGroupMapping.findMany({
    where: { company_id: companyId, identity_provider_id: providerId, enabled: true, auto_assign_role: true },
  });

  /* Fetch users from Microsoft Graph */
  let azureUsers;
  try {
    azureUsers = await fetchAzureUsers(provider.tenant_id, provider.client_id, provider.client_secret);
  } catch (e) {
    throw new Error(`Graph API error fetching users: ${(e as Error).message}`);
  }

  /* Process in batches of 50 */
  const BATCH = 50;
  for (let i = 0; i < azureUsers.length; i += BATCH) {
    const batch = azureUsers.slice(i, i + BATCH);

    await Promise.all(batch.map(async (azUser) => {
      const email = (azUser.mail ?? azUser.userPrincipalName ?? "").toLowerCase().trim();
      if (!email || !email.includes("@")) {
        result.skipped++;
        return;
      }

      try {
        const existing = await prisma.user.findUnique({ where: { email } });

        if (existing) {
          /* Never touch LOCAL users' core auth fields */
          if (existing.auth_provider === "LOCAL") {
            result.skipped++;
            return;
          }

          /* Determine role from group mappings if any */
          const existingGroups = (existing.external_group_ids as string[] | null) ?? [];
          const mappedRole = resolveMappedRole(existingGroups, groupMappings);

          await prisma.user.update({
            where: { id: existing.id },
            data: {
              name:             azUser.displayName ?? existing.name,
              external_user_id: azUser.id,
              is_external_user: true,
              last_sync_at:     new Date(),
              ...(mappedRole ? { role: mappedRole } : {}),
            },
          });
          result.updated++;
        } else {
          /* Auto-create gated by company setting */
          if (!authSettings?.auto_import_external_users) {
            result.skipped++;
            return;
          }

          /* Default role: USER unless a group mapping applies (requires group IDs — unknown at import time without extra Graph calls) */
          await prisma.user.create({
            data: {
              email,
              name:             azUser.displayName ?? email.split("@")[0],
              password_hash:    "",
              role:             "USER",
              company_id:       companyId,
              is_active:        azUser.accountEnabled ?? true,
              auth_provider:    "AZURE_AD",
              external_user_id: azUser.id,
              is_external_user: true,
              last_sync_at:     new Date(),
            },
          });
          result.imported++;
        }
      } catch (e) {
        result.errors.push(`${email}: ${(e as Error).message}`);
      }
    }));
  }

  void logAudit({
    company_id:  companyId,
    user_id:     actorId,
    action:      "AZURE_USERS_IMPORTED",
    module:      "AUTH",
    entity_type: "identity_provider",
    entity_id:   providerId,
    description: `Imported ${result.imported}, updated ${result.updated}, skipped ${result.skipped}, errors ${result.errors.length}`,
  });

  return result;
}

/* ── Sync Azure group memberships onto users ────────────────────────── */
export async function syncAzureGroups(
  providerId: string,
  companyId:  string,
  actorId:    string,
): Promise<SyncGroupsResult> {
  const result: SyncGroupsResult = { synced: 0, usersMapped: 0, errors: [] };

  const provider = await prisma.identityProvider.findFirst({
    where: { id: providerId, company_id: companyId, provider_type: "AZURE_AD", enabled: true },
  });

  if (!provider?.client_id || !provider.client_secret || !provider.tenant_id) {
    throw new Error("Azure AD provider not found or missing credentials.");
  }

  /* Fetch all groups from Graph */
  let azureGroups;
  try {
    azureGroups = await fetchAzureGroups(provider.tenant_id, provider.client_id, provider.client_secret);
  } catch (e) {
    throw new Error(`Graph API error fetching groups: ${(e as Error).message}`);
  }

  /* Load group mappings for role assignment */
  const groupMappings = await prisma.identityGroupMapping.findMany({
    where: { company_id: companyId, identity_provider_id: providerId, enabled: true },
  });

  /* For each mapped group, fetch its members and update user group IDs */
  const mappedGroupIds = new Set(groupMappings.map((m) => m.external_group_id));

  for (const group of azureGroups) {
    result.synced++;

    if (!mappedGroupIds.has(group.id)) continue;

    try {
      const members = await fetchGroupMembers(
        group.id, provider.tenant_id, provider.client_id, provider.client_secret,
      );

      for (const member of members) {
        const email = (member.mail ?? member.userPrincipalName ?? "").toLowerCase().trim();
        if (!email || !email.includes("@")) continue;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.company_id !== companyId || user.auth_provider === "LOCAL") continue;

        const currentGroups = (user.external_group_ids as string[] | null) ?? [];
        const updatedGroups = Array.from(new Set([...currentGroups, group.id]));

        /* Resolve role from mappings */
        const mappedRole = resolveMappedRole(updatedGroups, groupMappings.filter((m) => m.auto_assign_role));

        await prisma.user.update({
          where: { id: user.id },
          data: {
            external_group_ids: updatedGroups,
            last_sync_at:       new Date(),
            ...(mappedRole ? { role: mappedRole } : {}),
          },
        });
        result.usersMapped++;
      }
    } catch (e) {
      result.errors.push(`Group ${group.displayName ?? group.id}: ${(e as Error).message}`);
    }
  }

  void logAudit({
    company_id:  companyId,
    user_id:     actorId,
    action:      "AZURE_GROUPS_SYNCED",
    module:      "AUTH",
    entity_type: "identity_provider",
    entity_id:   providerId,
    description: `Synced ${result.synced} groups, mapped ${result.usersMapped} users, errors ${result.errors.length}`,
  });

  return result;
}

/* ── Resolve best role from a user's group IDs + active mappings ────── */
export function resolveMappedRole(
  userGroupIds: string[],
  mappings:     { external_group_id: string; app_role: Role | null; auto_assign_role: boolean }[],
): Role | null {
  const roleOrder: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER", "CHECKER", "APPROVER", "CEO", "USER"];

  const applicableMappings = mappings.filter(
    (m) => m.auto_assign_role && m.app_role && userGroupIds.includes(m.external_group_id),
  );

  if (applicableMappings.length === 0) return null;

  /* Return the highest-privilege role */
  for (const role of roleOrder) {
    if (applicableMappings.some((m) => m.app_role === role)) return role;
  }

  return null;
}

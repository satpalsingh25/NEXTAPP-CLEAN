/**
 * LDAP user import and group sync service.
 *
 * Rules enforced (mirrors Azure AD sync):
 *   - Never delete users
 *   - Never overwrite passwords
 *   - Never modify LOCAL users' auth_provider
 *   - Auto-create only if company allows auto_import_external_users
 *   - Group DNs stored on user.external_group_ids; role applied only if auto_assign_role=true
 */
import { prisma }           from "@/lib/prisma";
import { logAudit }         from "@/lib/audit-log";
import type { Role }        from "@prisma/client";
import {
  searchLdapUsers,
  searchLdapGroups,
  type LdapConfig,
} from "./client";

/* ── Result types ───────────────────────────────────────────────────── */
export interface ImportUsersResult {
  imported: number;
  updated:  number;
  skipped:  number;
  errors:   string[];
}

export interface SyncGroupsResult {
  synced:      number;
  usersMapped: number;
  errors:      string[];
}

/* ── Build LdapConfig from DB provider record ───────────────────────── */
function buildConfig(
  provider: {
    ldap_url: string | null;
    ldap_bind_dn: string | null;
    ldap_bind_password: string | null;
    ldap_base_dn: string | null;
    ldap_user_filter: string | null;
    ldap_group_filter: string | null;
    ldap_tls_enabled: boolean | null;
  },
): LdapConfig {
  if (!provider.ldap_url || !provider.ldap_bind_dn || !provider.ldap_bind_password || !provider.ldap_base_dn) {
    throw new Error("LDAP provider is missing required fields (url, bindDn, bindPassword, baseDn).");
  }
  return {
    url:          provider.ldap_url,
    bindDn:       provider.ldap_bind_dn,
    bindPassword: provider.ldap_bind_password,
    baseDn:       provider.ldap_base_dn,
    userFilter:   provider.ldap_user_filter   ?? "(objectClass=person)",
    groupFilter:  provider.ldap_group_filter  ?? "(objectClass=group)",
    tlsEnabled:   provider.ldap_tls_enabled   ?? false,
  };
}

/* ── Resolve best role from group DNs + active mappings ─────────────── */
export function resolveLdapMappedRole(
  userGroupDns: string[],
  mappings: { external_group_id: string; app_role: Role | null; auto_assign_role: boolean }[],
): Role | null {
  const roleOrder: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER", "CHECKER", "APPROVER", "CEO", "USER"];
  const applicableMappings = mappings.filter(
    (m) => m.auto_assign_role && m.app_role && userGroupDns.includes(m.external_group_id),
  );
  if (applicableMappings.length === 0) return null;
  for (const role of roleOrder) {
    if (applicableMappings.some((m) => m.app_role === role)) return role;
  }
  return null;
}

/* ── Check if an AD user account is disabled (userAccountControl bit 2) */
function isAdAccountDisabled(userAccountControl?: string): boolean {
  if (!userAccountControl) return false;
  const uac = parseInt(userAccountControl, 10);
  return !isNaN(uac) && (uac & 2) !== 0;
}

/* ── Import LDAP users into the application ─────────────────────────── */
export async function syncLdapUsers(
  providerId: string,
  companyId:  string,
  actorId:    string,
): Promise<ImportUsersResult> {
  const result: ImportUsersResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

  const provider = await prisma.identityProvider.findFirst({
    where: { id: providerId, company_id: companyId, provider_type: "LDAP", enabled: true },
  });
  if (!provider) throw new Error("LDAP provider not found or disabled.");

  const config = buildConfig(provider);

  const authSettings = await prisma.companyAuthSettings.findUnique({
    where: { company_id: companyId },
  });

  const groupMappings = await prisma.identityGroupMapping.findMany({
    where: { company_id: companyId, identity_provider_id: providerId, enabled: true, auto_assign_role: true },
  });

  let ldapUsers;
  try {
    ldapUsers = await searchLdapUsers(config);
  } catch (e) {
    throw new Error(`LDAP error fetching users: ${(e as Error).message}`);
  }

  const BATCH = 50;
  for (let i = 0; i < ldapUsers.length; i += BATCH) {
    const batch = ldapUsers.slice(i, i + BATCH);

    await Promise.all(batch.map(async (ldapUser) => {
      const email = (ldapUser.mail ?? "").toLowerCase().trim();
      if (!email || !email.includes("@")) {
        result.skipped++;
        return;
      }

      const isDisabled = isAdAccountDisabled(ldapUser.userAccountControl);
      const displayName = ldapUser.displayName ?? ldapUser.cn ?? email.split("@")[0];
      const externalId  = ldapUser.objectGUID ?? ldapUser.dn;
      const groupDns    = ldapUser.memberOf ?? [];

      try {
        const existing = await prisma.user.findUnique({ where: { email } });

        if (existing) {
          if (existing.auth_provider === "LOCAL") {
            result.skipped++;
            return;
          }

          const mappedRole = resolveLdapMappedRole(groupDns, groupMappings);

          await prisma.user.update({
            where: { id: existing.id },
            data: {
              name:               displayName,
              external_user_id:   externalId,
              external_group_ids: groupDns,
              is_external_user:   true,
              is_active:          !isDisabled,
              last_sync_at:       new Date(),
              ...(mappedRole ? { role: mappedRole } : {}),
            },
          });
          result.updated++;
        } else {
          if (!authSettings?.auto_import_external_users) {
            result.skipped++;
            return;
          }

          const mappedRole = resolveLdapMappedRole(groupDns, groupMappings);

          await prisma.user.create({
            data: {
              email,
              name:               displayName,
              password_hash:      "",
              role:               mappedRole ?? "USER",
              company_id:         companyId,
              is_active:          !isDisabled,
              auth_provider:      "LDAP",
              external_user_id:   externalId,
              external_group_ids: groupDns,
              is_external_user:   true,
              last_sync_at:       new Date(),
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
    action:      "LDAP_USERS_IMPORTED",
    module:      "AUTH",
    entity_type: "identity_provider",
    entity_id:   providerId,
    description: `Imported ${result.imported}, updated ${result.updated}, skipped ${result.skipped}, errors ${result.errors.length}`,
  });

  return result;
}

/* ── Sync LDAP group memberships onto users ─────────────────────────── */
export async function syncLdapGroups(
  providerId: string,
  companyId:  string,
  actorId:    string,
): Promise<SyncGroupsResult> {
  const result: SyncGroupsResult = { synced: 0, usersMapped: 0, errors: [] };

  const provider = await prisma.identityProvider.findFirst({
    where: { id: providerId, company_id: companyId, provider_type: "LDAP", enabled: true },
  });
  if (!provider) throw new Error("LDAP provider not found or disabled.");

  const config = buildConfig(provider);

  const groupMappings = await prisma.identityGroupMapping.findMany({
    where: { company_id: companyId, identity_provider_id: providerId, enabled: true },
  });

  let ldapGroups;
  try {
    ldapGroups = await searchLdapGroups(config);
  } catch (e) {
    throw new Error(`LDAP error fetching groups: ${(e as Error).message}`);
  }

  const mappedGroupDns = new Set(groupMappings.map((m) => m.external_group_id));

  for (const group of ldapGroups) {
    result.synced++;
    if (!mappedGroupDns.has(group.dn)) continue;

    try {
      const memberDns = group.member ?? [];

      for (const memberDn of memberDns) {
        /* Look up user by their LDAP DN stored as external_user_id */
        const user = await prisma.user.findFirst({
          where: { company_id: companyId, external_user_id: memberDn, auth_provider: "LDAP" },
        });
        if (!user) continue;

        const currentGroups = (user.external_group_ids as string[] | null) ?? [];
        const updatedGroups = Array.from(new Set([...currentGroups, group.dn]));
        const mappedRole    = resolveLdapMappedRole(
          updatedGroups,
          groupMappings.filter((m) => m.auto_assign_role),
        );

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
      result.errors.push(`Group ${group.cn ?? group.dn}: ${(e as Error).message}`);
    }
  }

  void logAudit({
    company_id:  companyId,
    user_id:     actorId,
    action:      "LDAP_GROUPS_SYNCED",
    module:      "AUTH",
    entity_type: "identity_provider",
    entity_id:   providerId,
    description: `Synced ${result.synced} groups, mapped ${result.usersMapped} users, errors ${result.errors.length}`,
  });

  return result;
}

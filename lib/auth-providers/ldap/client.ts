/**
 * LDAP client — low-level operations for LDAP/Active Directory integration.
 * Uses ldapts (TypeScript-native, no native bindings, supports TLS/LDAPS).
 */
import { Client, type SearchOptions } from "ldapts";

export interface LdapConfig {
  url:          string;
  bindDn:       string;
  bindPassword: string;
  baseDn:       string;
  userFilter:   string;
  groupFilter:  string;
  tlsEnabled:   boolean;
}

export interface LdapUser {
  dn:          string;
  uid?:        string;
  cn?:         string;
  mail?:       string;
  displayName?: string;
  memberOf?:   string[];
  objectGUID?: string;
  sAMAccountName?: string;
  userAccountControl?: string;
}

export interface LdapGroup {
  dn:          string;
  cn?:         string;
  description?: string;
  member?:     string[];
}

/* ── LDAP special-character escaping (RFC 4515) ─────────────────────── */
export function escapeLdapFilter(value: string): string {
  return value
    .replace(/\\/g, "\\5c")
    .replace(/\*/g, "\\2a")
    .replace(/\(/g, "\\28")
    .replace(/\)/g, "\\29")
    .replace(/\0/g, "\\00");
}

/* ── Build a Client from config ─────────────────────────────────────── */
function buildClient(config: LdapConfig): Client {
  return new Client({
    url:     config.url,
    tlsOptions: config.tlsEnabled ? { rejectUnauthorized: false } : undefined,
    timeout:    10000,
    connectTimeout: 10000,
  });
}

/* ── Test connection and service bind ───────────────────────────────── */
export async function testLdapConnection(
  config: LdapConfig,
): Promise<{ success: boolean; message: string }> {
  const client = buildClient(config);
  try {
    await client.bind(config.bindDn, config.bindPassword);
    await client.unbind();
    return { success: true, message: "Connection successful — bind credentials are valid." };
  } catch (e) {
    const msg = (e as Error).message ?? "Unknown error";
    return { success: false, message: `LDAP connection failed: ${msg}` };
  }
}

/* ── Search users from LDAP ─────────────────────────────────────────── */
export async function searchLdapUsers(config: LdapConfig): Promise<LdapUser[]> {
  const client = buildClient(config);
  try {
    await client.bind(config.bindDn, config.bindPassword);

    const opts: SearchOptions = {
      filter:     config.userFilter || "(objectClass=person)",
      scope:      "sub",
      attributes: [
        "dn", "uid", "cn", "displayName", "mail", "sAMAccountName",
        "objectGUID", "memberOf", "userAccountControl",
      ],
    };

    const { searchEntries } = await client.search(config.baseDn, opts);
    await client.unbind();

    return searchEntries.map((e) => ({
      dn:                 e.dn,
      uid:                asString(e.uid),
      cn:                 asString(e.cn),
      displayName:        asString(e.displayName),
      mail:               asString(e.mail),
      sAMAccountName:     asString(e.sAMAccountName),
      objectGUID:         asString(e.objectGUID),
      memberOf:           asStringArray(e.memberOf),
      userAccountControl: asString(e.userAccountControl),
    }));
  } catch {
    await client.unbind().catch(() => {});
    throw new Error("Failed to search LDAP users.");
  }
}

/* ── Search groups from LDAP ────────────────────────────────────────── */
export async function searchLdapGroups(config: LdapConfig): Promise<LdapGroup[]> {
  const client = buildClient(config);
  try {
    await client.bind(config.bindDn, config.bindPassword);

    const opts: SearchOptions = {
      filter:     config.groupFilter || "(objectClass=group)",
      scope:      "sub",
      attributes: ["dn", "cn", "description", "member"],
    };

    const { searchEntries } = await client.search(config.baseDn, opts);
    await client.unbind();

    return searchEntries.map((e) => ({
      dn:          e.dn,
      cn:          asString(e.cn),
      description: asString(e.description),
      member:      asStringArray(e.member),
    }));
  } catch {
    await client.unbind().catch(() => {});
    throw new Error("Failed to search LDAP groups.");
  }
}

/* ── Find a single user by email (or sAMAccountName) ───────────────── */
export async function findLdapUserByEmail(
  config: LdapConfig,
  email:  string,
): Promise<LdapUser | null> {
  const client = buildClient(config);
  try {
    await client.bind(config.bindDn, config.bindPassword);

    const escaped = escapeLdapFilter(email);
    const filter  = `(|(mail=${escaped})(userPrincipalName=${escaped}))`;

    const { searchEntries } = await client.search(config.baseDn, {
      filter,
      scope:      "sub",
      attributes: [
        "dn", "uid", "cn", "displayName", "mail", "sAMAccountName",
        "objectGUID", "memberOf", "userAccountControl",
      ],
      sizeLimit: 1,
    });

    await client.unbind();
    if (searchEntries.length === 0) return null;
    const e = searchEntries[0];
    return {
      dn:                 e.dn,
      uid:                asString(e.uid),
      cn:                 asString(e.cn),
      displayName:        asString(e.displayName),
      mail:               asString(e.mail),
      sAMAccountName:     asString(e.sAMAccountName),
      objectGUID:         asString(e.objectGUID),
      memberOf:           asStringArray(e.memberOf),
      userAccountControl: asString(e.userAccountControl),
    };
  } catch {
    await client.unbind().catch(() => {});
    return null;
  }
}

/* ── Attempt a user bind (verify password) ──────────────────────────── */
export async function verifyLdapUserPassword(
  config:   LdapConfig,
  userDn:   string,
  password: string,
): Promise<boolean> {
  const client = buildClient(config);
  try {
    await client.bind(userDn, password);
    await client.unbind();
    return true;
  } catch {
    await client.unbind().catch(() => {});
    return false;
  }
}

/* ── Helpers to normalise ldapts attribute values ───────────────────── */
function asString(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (Array.isArray(val))     return val[0] as string | undefined;
  return undefined;
}

function asStringArray(val: unknown): string[] {
  if (Array.isArray(val))     return val.filter((v) => typeof v === "string") as string[];
  if (typeof val === "string") return [val];
  return [];
}

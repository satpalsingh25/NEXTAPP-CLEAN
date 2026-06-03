/**
 * Microsoft Graph API client for Azure AD user and group sync.
 *
 * Uses the Client Credentials flow (app-only) to obtain an access token,
 * then calls Graph to list users, groups, and memberships.
 *
 * Required Azure app permissions (Application, not Delegated):
 *   - User.Read.All
 *   - Group.Read.All
 *   - GroupMember.Read.All
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

/* ── Token cache ────────────────────────────────────────────────────── */
interface TokenEntry {
  token:     string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenEntry>();

export async function getGraphAccessToken(
  tenantId:     string,
  clientId:     string,
  clientSecret: string,
): Promise<string> {
  const cacheKey = `${tenantId}:${clientId}`;
  const cached   = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt - 30_000) return cached.token;

  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         "https://graph.microsoft.com/.default",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
      signal:  AbortSignal.timeout(15_000),
    },
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, string>;
    throw new Error(`Graph token request failed: ${err.error_description ?? res.statusText}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set(cacheKey, {
    token:     data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });

  return data.access_token;
}

/* ── Generic Graph paged fetch ──────────────────────────────────────── */
async function graphGetAll<T>(
  url:   string,
  token: string,
): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal:  AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(`Graph request failed (${res.status}): ${err.error?.message ?? res.statusText}`);
    }

    const data = (await res.json()) as { value: T[]; "@odata.nextLink"?: string };
    results.push(...data.value);
    nextUrl = data["@odata.nextLink"] ?? null;
  }

  return results;
}

/* ── Public types ───────────────────────────────────────────────────── */
export interface GraphUser {
  id:                string;
  displayName:       string | null;
  mail:              string | null;
  userPrincipalName: string | null;
  accountEnabled:    boolean | null;
  jobTitle:          string | null;
  department:        string | null;
}

export interface GraphGroup {
  id:          string;
  displayName: string | null;
  description: string | null;
  mail:        string | null;
}

export interface GraphGroupMember {
  id:                string;
  "@odata.type":     string;
  userPrincipalName?: string | null;
  mail?:             string | null;
}

/* ── Fetch all Azure AD users ───────────────────────────────────────── */
export async function fetchAzureUsers(
  tenantId:     string,
  clientId:     string,
  clientSecret: string,
): Promise<GraphUser[]> {
  const token = await getGraphAccessToken(tenantId, clientId, clientSecret);
  const select = "id,displayName,mail,userPrincipalName,accountEnabled,jobTitle,department";
  return graphGetAll<GraphUser>(`${GRAPH_BASE}/users?$select=${select}&$top=999`, token);
}

/* ── Fetch all Azure AD groups ──────────────────────────────────────── */
export async function fetchAzureGroups(
  tenantId:     string,
  clientId:     string,
  clientSecret: string,
): Promise<GraphGroup[]> {
  const token = await getGraphAccessToken(tenantId, clientId, clientSecret);
  const select = "id,displayName,description,mail";
  return graphGetAll<GraphGroup>(`${GRAPH_BASE}/groups?$select=${select}&$top=999`, token);
}

/* ── Fetch members of a specific group ─────────────────────────────── */
export async function fetchGroupMembers(
  groupId:      string,
  tenantId:     string,
  clientId:     string,
  clientSecret: string,
): Promise<GraphGroupMember[]> {
  const token = await getGraphAccessToken(tenantId, clientId, clientSecret);
  return graphGetAll<GraphGroupMember>(
    `${GRAPH_BASE}/groups/${groupId}/members?$select=id,userPrincipalName,mail&$top=999`,
    token,
  );
}

/* ── Fetch all groups a user belongs to ────────────────────────────── */
export async function fetchUserGroupIds(
  userId:       string,
  tenantId:     string,
  clientId:     string,
  clientSecret: string,
): Promise<string[]> {
  const token = await getGraphAccessToken(tenantId, clientId, clientSecret);
  const items = await graphGetAll<{ id: string }>(
    `${GRAPH_BASE}/users/${userId}/memberOf?$select=id&$top=999`,
    token,
  );
  return items.map((g) => g.id);
}

/**
 * Azure AD / Microsoft Entra ID OAuth 2.0 + OIDC client.
 *
 * No external packages required — uses:
 *   - Node.js built-in `crypto` for JWK → KeyObject conversion (Node 18+)
 *   - `jsonwebtoken` (already in project) for JWT verification
 *   - Built-in `fetch` for Microsoft endpoints
 */
import crypto           from "crypto";
import jwt, { type JwtHeader, type JwtPayload } from "jsonwebtoken";

/* ── JWKS in-memory cache ───────────────────────────────────────────── */
interface JwkKey {
  kty:    string;
  use?:   string;
  kid:    string;
  n?:     string;
  e?:     string;
  [key:   string]: unknown;
}

interface JwksCache {
  keys:      JwkKey[];
  fetchedAt: number;
}

const jwksCache = new Map<string, JwksCache>();
const JWKS_TTL  = 60 * 60 * 1000; // 1 hour

async function getJwks(tenantId: string): Promise<JwkKey[]> {
  const cached = jwksCache.get(tenantId);
  if (cached && Date.now() - cached.fetchedAt < JWKS_TTL) return cached.keys;

  const url = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`JWKS fetch failed (${res.status}) for tenant ${tenantId}`);

  const data = (await res.json()) as { keys: JwkKey[] };
  jwksCache.set(tenantId, { keys: data.keys, fetchedAt: Date.now() });
  return data.keys;
}

/* ── Public types ───────────────────────────────────────────────────── */
export interface AzureProviderConfig {
  clientId:     string;
  clientSecret: string;
  tenantId:     string;
  redirectUri:  string;
  scopes:       string;
}

export interface MicrosoftIdTokenClaims extends JwtPayload {
  tid:                  string;   // tenant ID
  oid:                  string;   // object ID — stable unique user ID in Azure
  email?:               string;
  preferred_username?:  string;
  name?:                string;
  nonce?:               string;
}

/* ── Build the Microsoft authorization redirect URL ─────────────────── */
export function buildAuthUrl(
  config: AzureProviderConfig,
  state:  string,
  nonce:  string,
): string {
  const params = new URLSearchParams({
    client_id:     config.clientId,
    response_type: "code",
    redirect_uri:  config.redirectUri,
    scope:         config.scopes || "openid profile email User.Read",
    state,
    nonce,
    response_mode: "query",
  });
  return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params}`;
}

/* ── Exchange authorization code for tokens ─────────────────────────── */
export async function exchangeCodeForTokens(
  code:   string,
  config: AzureProviderConfig,
): Promise<{ id_token: string; access_token?: string }> {
  const body = new URLSearchParams({
    client_id:     config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri:  config.redirectUri,
    grant_type:    "authorization_code",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
      signal:  AbortSignal.timeout(15_000),
    },
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, string>;
    throw new Error(`Token exchange failed: ${err.error_description ?? res.statusText}`);
  }

  return res.json() as Promise<{ id_token: string; access_token?: string }>;
}

/* ── Validate the Microsoft id_token ────────────────────────────────── */
export async function validateIdToken(
  idToken: string,
  config:  AzureProviderConfig,
  nonce:   string,
): Promise<MicrosoftIdTokenClaims> {
  /* Decode header to get `kid` — no verification yet */
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === "string") throw new Error("Invalid id_token format");

  const header = decoded.header as JwtHeader;
  if (!header.kid) throw new Error("id_token header missing kid");

  /* Fetch Microsoft's public signing keys for this tenant */
  const keys = await getJwks(config.tenantId);
  const jwk  = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    /* Retry once with fresh JWKS (key rotation) */
    jwksCache.delete(config.tenantId);
    const fresh = await getJwks(config.tenantId);
    const retry = fresh.find((k) => k.kid === header.kid);
    if (!retry) throw new Error("Signing key not found in Microsoft JWKS");
  }

  const signingJwk = (keys.find((k) => k.kid === header.kid) ??
    (await getJwks(config.tenantId)).find((k) => k.kid === header.kid))!;

  /* Convert JWK → Node.js KeyObject using built-in crypto (Node 18+) */
  const publicKey = crypto.createPublicKey({
    key:    signingJwk as Parameters<typeof crypto.createPublicKey>[0] extends { key: infer K } ? K : never,
    format: "jwk",
  });

  /* Verify signature + standard claims */
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ["RS256"],
    audience:   config.clientId,
    issuer: [
      `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
      `https://sts.windows.net/${config.tenantId}/`,
    ],
  }) as MicrosoftIdTokenClaims;

  /* Tenant isolation — reject cross-tenant tokens */
  if (payload.tid !== config.tenantId) {
    throw new Error("Tenant ID mismatch — cross-tenant login rejected");
  }

  /* Nonce — replay attack protection */
  if (!nonce || payload.nonce !== nonce) {
    throw new Error("Nonce mismatch — possible replay attack");
  }

  return payload;
}

/* ── Test connection: validate tenant via OpenID metadata endpoint ──── */
export async function testAzureConnection(
  tenantId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const url = `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      return { success: false, message: `Tenant not found or unreachable (HTTP ${res.status})` };
    }
    const meta = (await res.json()) as { issuer?: string; token_endpoint?: string };
    if (!meta.issuer) return { success: false, message: "Invalid OpenID configuration returned" };
    return { success: true, message: `Tenant validated. Issuer: ${meta.issuer}` };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

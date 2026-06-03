/**
 * Generic OIDC client — uses `jose` for JWT/JWKS validation and
 * native fetch for discovery + token exchange.
 *
 * Compatible with: Okta, Auth0, Keycloak, OneLogin, Ping Identity,
 *                  Google Workspace, any standards-compliant IdP.
 */
import { createRemoteJWKSet, jwtVerify }  from "jose";
import crypto                             from "crypto";

/* ── Types ─────────────────────────────────────────────────────────── */

export interface OidcConfig {
  issuerUrl:    string;   // e.g. "https://accounts.google.com"
  discoveryUrl?: string;  // override; defaults to issuerUrl + "/.well-known/openid-configuration"
  clientId:     string;
  clientSecret: string;
  callbackUrl:  string;
  scopes?:      string;  // space-separated; default "openid profile email"
}

export interface OidcDiscovery {
  issuer:                                  string;
  authorization_endpoint:                  string;
  token_endpoint:                          string;
  userinfo_endpoint?:                      string;
  jwks_uri:                                string;
  end_session_endpoint?:                   string;
  scopes_supported?:                       string[];
  response_types_supported:                string[];
  subject_types_supported?:                string[];
  id_token_signing_alg_values_supported?:  string[];
}

export interface OidcTokenSet {
  access_token:  string;
  id_token:      string;
  token_type:    string;
  expires_in?:   number;
  refresh_token?: string;
}

export interface OidcClaims {
  sub:           string;
  email:         string;
  emailVerified: boolean;
  name?:         string;
  givenName?:    string;
  familyName?:   string;
  picture?:      string;
  raw:           Record<string, unknown>;
}

/* ── Discovery ──────────────────────────────────────────────────────── */

const _discoveryCache = new Map<string, { doc: OidcDiscovery; expiresAt: number }>();

export async function fetchDiscovery(config: Pick<OidcConfig, "issuerUrl" | "discoveryUrl">): Promise<OidcDiscovery> {
  const url = config.discoveryUrl
    ? config.discoveryUrl
    : `${config.issuerUrl.replace(/\/$/, "")}/.well-known/openid-configuration`;

  /* Cache for 15 minutes */
  const cached = _discoveryCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.doc;

  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ComplianceApp-OIDC/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`OIDC discovery failed: HTTP ${res.status} from ${url}`);
  }
  const doc = (await res.json()) as OidcDiscovery;
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) {
    throw new Error("OIDC discovery document is missing required fields.");
  }

  _discoveryCache.set(url, { doc, expiresAt: Date.now() + 15 * 60 * 1000 });
  return doc;
}

/* ── Login URL ──────────────────────────────────────────────────────── */

export interface OidcLoginParams {
  state: string;   // random; also encodes provider_id — see caller
  nonce: string;   // random; for replay protection
}

export function generateOidcParams(): OidcLoginParams {
  return {
    state: crypto.randomBytes(24).toString("hex"),
    nonce: crypto.randomBytes(24).toString("hex"),
  };
}

export async function buildOidcLoginUrl(
  config: OidcConfig,
  state:  string,
  nonce:  string,
): Promise<string> {
  const discovery = await fetchDiscovery(config);
  const scopes    = config.scopes ?? "openid profile email";

  const params = new URLSearchParams({
    response_type: "code",
    client_id:     config.clientId,
    redirect_uri:  config.callbackUrl,
    scope:         scopes,
    state,
    nonce,
  });

  return `${discovery.authorization_endpoint}?${params.toString()}`;
}

/* ── Token Exchange ─────────────────────────────────────────────────── */

export async function exchangeCode(
  config: OidcConfig,
  code:   string,
): Promise<OidcTokenSet> {
  const discovery = await fetchDiscovery(config);

  const res = await fetch(discovery.token_endpoint, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      code,
      redirect_uri:  config.callbackUrl,
      client_id:     config.clientId,
      client_secret: config.clientSecret,
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${errBody.slice(0, 200)}`);
  }

  return (await res.json()) as OidcTokenSet;
}

/* ── ID Token Validation ────────────────────────────────────────────── */

export async function validateIdToken(
  config:   OidcConfig,
  idToken:  string,
  nonce:    string,
): Promise<OidcClaims> {
  const discovery = await fetchDiscovery(config);
  const JWKS      = createRemoteJWKSet(new URL(discovery.jwks_uri));

  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer:   discovery.issuer,
    audience: config.clientId,
  });

  /* Nonce check — replay protection */
  if (payload.nonce !== nonce) {
    throw new Error("OIDC nonce mismatch — possible replay attack.");
  }

  /* Extract email */
  const email = (payload.email as string | undefined) ?? "";
  if (!email) {
    throw new Error("OIDC ID token did not include an email claim.");
  }

  return {
    sub:           payload.sub ?? "",
    email:         email.toLowerCase().trim(),
    emailVerified: !!(payload.email_verified),
    name:          payload.name    as string | undefined,
    givenName:     payload.given_name  as string | undefined,
    familyName:    payload.family_name as string | undefined,
    picture:       payload.picture as string | undefined,
    raw:           payload as Record<string, unknown>,
  };
}

/* ── Optional: Fetch user info ──────────────────────────────────────── */

export async function fetchUserInfo(
  config:      OidcConfig,
  accessToken: string,
): Promise<Record<string, unknown>> {
  const discovery = await fetchDiscovery(config);
  if (!discovery.userinfo_endpoint) return {};

  const res = await fetch(discovery.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal:  AbortSignal.timeout(8_000),
  });
  if (!res.ok) return {};
  return (await res.json()) as Record<string, unknown>;
}

/* ── Test Connection ─────────────────────────────────────────────────── */

export async function testOidcConnection(
  config: Pick<OidcConfig, "issuerUrl" | "discoveryUrl" | "clientId">,
): Promise<{ success: boolean; message: string; details?: string }> {
  if (!config.issuerUrl && !config.discoveryUrl) {
    return { success: false, message: "Issuer URL or Discovery URL is required." };
  }
  if (!config.clientId) {
    return { success: false, message: "Client ID is required." };
  }

  try {
    const doc = await fetchDiscovery(config);
    return {
      success: true,
      message: `Discovery document fetched successfully. Issuer: ${doc.issuer}`,
      details: JSON.stringify({
        authorization_endpoint: doc.authorization_endpoint,
        token_endpoint:         doc.token_endpoint,
        jwks_uri:               doc.jwks_uri,
        scopes_supported:       doc.scopes_supported?.slice(0, 6),
      }, null, 2),
    };
  } catch (e) {
    return {
      success: false,
      message: `Could not fetch OIDC discovery: ${(e as Error).message}`,
    };
  }
}

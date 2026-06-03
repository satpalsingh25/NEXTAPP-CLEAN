/**
 * GET /api/auth/oidc/login?provider_id={id}
 *
 * Initiates Generic OIDC authorization code flow.
 * - Validates the IdentityProvider exists, is OIDC type, and is enabled.
 * - Fetches the OIDC discovery document.
 * - Generates state + nonce for CSRF and replay protection.
 * - Stores state, nonce, provider_id in short-lived HttpOnly cookies.
 * - Redirects the browser to the IdP authorization endpoint.
 */
import { NextRequest, NextResponse }      from "next/server";
import { prisma }                          from "@/lib/prisma";
import { checkRateLimit, getClientIp }     from "@/lib/rate-limit";
import { buildOidcLoginUrl, generateOidcParams } from "@/lib/auth-providers/oidc/client";
import { logInternalError }                from "@/lib/error-log";

const STATE_COOKIE    = "oidc_state";
const NONCE_COOKIE    = "oidc_nonce";
const PROVIDER_COOKIE = "oidc_pid";
const COOKIE_MAX_AGE  = 10 * 60; // 10 minutes

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "oidc-login-init", "login");
  if (rl) return rl;

  const { searchParams } = new URL(req.url);
  const providerId       = searchParams.get("provider_id");

  if (!providerId) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_provider", req.url));
  }

  try {
    const provider = await prisma.identityProvider.findFirst({
      where: { id: providerId, provider_type: "OIDC", enabled: true },
    });

    if (!provider) {
      return NextResponse.redirect(new URL("/auth/login?error=provider_not_configured", req.url));
    }

    const authSettings = await prisma.companyAuthSettings.findUnique({
      where: { company_id: provider.company_id },
    });
    if (!authSettings?.allow_oidc_login) {
      return NextResponse.redirect(new URL("/auth/login?error=oidc_not_enabled", req.url));
    }

    if (!provider.oidc_issuer_url || !provider.oidc_client_id || !provider.oidc_client_secret) {
      return NextResponse.redirect(new URL("/auth/login?error=provider_not_configured", req.url));
    }

    const baseUrl     = new URL(req.url).origin;
    const callbackUrl = `${baseUrl}/api/auth/oidc/callback`;

    const { state, nonce } = generateOidcParams();

    const loginUrl = await buildOidcLoginUrl(
      {
        issuerUrl:    provider.oidc_issuer_url,
        discoveryUrl: provider.oidc_discovery_url ?? undefined,
        clientId:     provider.oidc_client_id,
        clientSecret: provider.oidc_client_secret,
        callbackUrl,
        scopes:       provider.scopes ?? "openid profile email",
      },
      state,
      nonce,
    );

    const isProd      = process.env.NODE_ENV === "production";
    const cookieOpts  = `; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${isProd ? "; Secure" : ""}`;

    const res = NextResponse.redirect(loginUrl);
    res.headers.append("Set-Cookie", `${STATE_COOKIE}=${state}${cookieOpts}`);
    res.headers.append("Set-Cookie", `${NONCE_COOKIE}=${nonce}${cookieOpts}`);
    res.headers.append("Set-Cookie", `${PROVIDER_COOKIE}=${providerId}${cookieOpts}`);
    return res;

  } catch (e) {
    logInternalError(e, { route: "GET /api/auth/oidc/login" });
    return NextResponse.redirect(new URL("/auth/login?error=oidc_auth_failed", req.url));
  }
}

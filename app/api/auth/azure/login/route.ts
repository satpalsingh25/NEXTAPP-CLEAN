import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@/lib/prisma";
import { buildAuthUrl }              from "@/lib/auth-providers/azure-ad-client";
import crypto                        from "crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * GET /api/auth/azure/login?provider_id={id}
 *
 * Initiates the Microsoft OAuth 2.0 authorization code flow.
 * - Validates the requested IdentityProvider exists and is enabled.
 * - Generates a CSRF state token and a nonce for replay protection.
 * - Stores both in short-lived HttpOnly cookies.
 * - Redirects the browser to Microsoft's authorization endpoint.
 */
export async function GET(req: NextRequest) {
  /* Rate-limit Azure login initiations to prevent enumeration */
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "azure-login-init", "login");
  if (rl) return rl;

  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get("provider_id");

  if (!providerId) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_provider", req.url));
  }

  /* Look up the IdentityProvider — must be AZURE_AD + enabled */
  const provider = await prisma.identityProvider.findFirst({
    where: {
      id:            providerId,
      provider_type: "AZURE_AD",
      enabled:       true,
    },
    select: {
      id:            true,
      client_id:     true,
      tenant_id:     true,
      redirect_uri:  true,
      scopes:        true,
      company_id:    true,
    },
  });

  if (!provider || !provider.client_id || !provider.tenant_id || !provider.redirect_uri) {
    return NextResponse.redirect(new URL("/auth/login?error=provider_not_configured", req.url));
  }

  /* Generate CSRF state — embeds provider_id so callback can look it up */
  const randomPart = crypto.randomBytes(20).toString("hex");
  const state      = `${randomPart}:${provider.id}`;

  /* Generate nonce for replay protection */
  const nonce = crypto.randomBytes(20).toString("hex");

  const authUrl = buildAuthUrl(
    {
      clientId:    provider.client_id,
      clientSecret: "",               // not needed for URL building
      tenantId:    provider.tenant_id,
      redirectUri: provider.redirect_uri,
      scopes:      provider.scopes || "openid profile email User.Read",
    },
    state,
    nonce,
  );

  const response = NextResponse.redirect(authUrl);

  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production" || !!process.env.REPLIT_DOMAINS,
    sameSite: "lax" as const,
    maxAge:   10 * 60, // 10 minutes — OAuth round-trip window
    path:     "/",
  };

  response.cookies.set("az_state", state, cookieOpts);
  response.cookies.set("az_nonce", nonce,  cookieOpts);

  return response;
}

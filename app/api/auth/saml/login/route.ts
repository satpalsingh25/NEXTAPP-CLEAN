/**
 * GET /api/auth/saml/login?provider_id={id}
 *
 * Initiates SAML 2.0 SP-initiated SSO.
 * - Validates the IdentityProvider exists, is SAML type, and is enabled.
 * - Checks company auth settings allow SAML login.
 * - Generates the IdP redirect URL via @node-saml/node-saml.
 * - Embeds provider_id as RelayState so the callback can re-look it up.
 */
import { NextRequest, NextResponse }      from "next/server";
import { prisma }                          from "@/lib/prisma";
import { checkRateLimit, getClientIp }     from "@/lib/rate-limit";
import { getSamlLoginUrl }                 from "@/lib/auth-providers/saml/client";
import { logInternalError }                from "@/lib/error-log";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "saml-login-init", "login");
  if (rl) return rl;

  const { searchParams } = new URL(req.url);
  const providerId       = searchParams.get("provider_id");

  if (!providerId) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_provider", req.url));
  }

  try {
    const provider = await prisma.identityProvider.findFirst({
      where: { id: providerId, provider_type: "SAML", enabled: true },
    });

    if (!provider) {
      return NextResponse.redirect(new URL("/auth/login?error=provider_not_configured", req.url));
    }

    /* Check company allows SAML login */
    const authSettings = await prisma.companyAuthSettings.findUnique({
      where: { company_id: provider.company_id },
    });
    if (!authSettings?.allow_saml_login) {
      return NextResponse.redirect(new URL("/auth/login?error=saml_not_enabled", req.url));
    }

    if (!provider.saml_entry_point || !provider.saml_issuer || !provider.saml_certificate) {
      return NextResponse.redirect(new URL("/auth/login?error=provider_not_configured", req.url));
    }

    const baseUrl     = new URL(req.url).origin;
    const callbackUrl = `${baseUrl}/api/auth/saml/callback`;

    const loginUrl = await getSamlLoginUrl(
      {
        entryPoint:  provider.saml_entry_point,
        issuer:      provider.saml_issuer,
        certificate: provider.saml_certificate,
        callbackUrl,
        logoutUrl:   provider.saml_logout_url ?? undefined,
      },
      providerId,
    );

    return NextResponse.redirect(loginUrl);
  } catch (e) {
    logInternalError(e, { route: "GET /api/auth/saml/login" });
    return NextResponse.redirect(new URL("/auth/login?error=saml_auth_failed", req.url));
  }
}

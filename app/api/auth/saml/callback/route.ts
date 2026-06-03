/**
 * POST /api/auth/saml/callback
 *
 * SAML 2.0 Assertion Consumer Service (ACS) endpoint.
 * - Receives SAMLResponse + RelayState from the IdP (POST binding).
 * - Validates signature and extracts user claims.
 * - Creates or updates the app user.
 * - Establishes a session and redirects to dashboard.
 */
import { NextRequest, NextResponse }      from "next/server";
import { prisma }                          from "@/lib/prisma";
import { createSessionResponse }           from "@/lib/auth-session";
import { validateSamlResponse }            from "@/lib/auth-providers/saml/client";
import { logInternalError }                from "@/lib/error-log";
import { logAudit }                        from "@/lib/audit-log";
import { checkRateLimit, getClientIp }     from "@/lib/rate-limit";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "saml-callback", "submit");
  if (rl) return rl;

  let samlResponse: string;
  let relayState:   string;

  /* Parse form-encoded SAML POST body */
  try {
    const text = await req.text();
    const body = new URLSearchParams(text);
    samlResponse = body.get("SAMLResponse") ?? "";
    relayState   = body.get("RelayState")   ?? "";
  } catch {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_callback", req.url));
  }

  if (!samlResponse) {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_callback", req.url));
  }

  /* RelayState holds the provider_id */
  const providerId = relayState;
  if (!providerId) {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_callback", req.url));
  }

  try {
    const provider = await prisma.identityProvider.findFirst({
      where: { id: providerId, provider_type: "SAML", enabled: true },
    });

    if (!provider || !provider.saml_entry_point || !provider.saml_issuer || !provider.saml_certificate) {
      return NextResponse.redirect(new URL("/auth/login?error=provider_not_configured", req.url));
    }

    const authSettings = await prisma.companyAuthSettings.findUnique({
      where: { company_id: provider.company_id },
    });
    if (!authSettings?.allow_saml_login) {
      return NextResponse.redirect(new URL("/auth/login?error=saml_not_enabled", req.url));
    }

    const baseUrl     = new URL(req.url).origin;
    const callbackUrl = `${baseUrl}/api/auth/saml/callback`;

    /* Validate SAML assertion */
    const claims = await validateSamlResponse(
      {
        entryPoint:  provider.saml_entry_point,
        issuer:      provider.saml_issuer,
        certificate: provider.saml_certificate,
        callbackUrl,
        logoutUrl:   provider.saml_logout_url ?? undefined,
      },
      providerId,
      samlResponse,
    );

    const email       = claims.email;
    const displayName = claims.displayName
      ?? (claims.firstName && claims.lastName ? `${claims.firstName} ${claims.lastName}` : undefined)
      ?? email.split("@")[0];

    /* Find or create the app user */
    let appUser = await prisma.user.findUnique({ where: { email } });

    if (appUser) {
      /* Existing user — must be a SAML user or be importable */
      if (appUser.auth_provider === "LOCAL" && appUser.company_id !== provider.company_id) {
        return NextResponse.redirect(new URL("/auth/login?error=company_mismatch", req.url));
      }
      if (!appUser.is_active) {
        return NextResponse.redirect(new URL("/auth/login?error=account_disabled", req.url));
      }
      appUser = await prisma.user.update({
        where: { id: appUser.id },
        data: {
          name:             displayName,
          external_user_id: claims.nameID || undefined,
          last_sync_at:     new Date(),
        },
      });
    } else {
      /* Auto-import new user */
      if (!authSettings.auto_import_external_users) {
        return NextResponse.redirect(new URL("/auth/login?error=auto_import_disabled", req.url));
      }
      appUser = await prisma.user.create({
        data: {
          email,
          name:             displayName,
          password_hash:    "",
          role:             "USER",
          company_id:       provider.company_id,
          is_active:        true,
          auth_provider:    "SAML",
          external_user_id: claims.nameID || undefined,
          is_external_user: true,
          last_sync_at:     new Date(),
        },
      });

      void logAudit({
        company_id:  provider.company_id,
        user_id:     appUser.id,
        action:      "AUTO_IMPORT_SSO_USER",
        module:      "AUTH",
        entity_type: "user",
        entity_id:   appUser.id,
        description: `Auto-imported SAML user: ${email} via provider ${provider.name}`,
      });
    }

    void logAudit({
      company_id:  provider.company_id,
      user_id:     appUser.id,
      action:      "LOGIN_SUCCESS",
      module:      "AUTH",
      entity_type: "user",
      entity_id:   appUser.id,
      description: `SAML login via ${provider.name}`,
    });

    return createSessionResponse(req, {
      id:         appUser.id,
      email:      appUser.email,
      role:       appUser.role,
      company_id: appUser.company_id,
    }, "/dashboard");

  } catch (e) {
    logInternalError(e, { route: "POST /api/auth/saml/callback" });
    return NextResponse.redirect(new URL("/auth/login?error=saml_auth_failed", req.url));
  }
}

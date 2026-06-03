/**
 * GET /api/auth/oidc/callback?code={code}&state={state}
 *
 * OIDC authorization code callback.
 * - Verifies state against the oidc_state cookie (CSRF protection).
 * - Reads provider_id from the oidc_pid cookie.
 * - Exchanges the code for tokens at the token endpoint.
 * - Validates the ID token signature, issuer, audience, expiry, and nonce.
 * - Creates or updates the app user.
 * - Establishes a session and redirects to dashboard.
 */
import { NextRequest, NextResponse }      from "next/server";
import { prisma }                          from "@/lib/prisma";
import { createSessionResponse }           from "@/lib/auth-session";
import { exchangeCode, validateIdToken }   from "@/lib/auth-providers/oidc/client";
import { logInternalError }                from "@/lib/error-log";
import { logAudit }                        from "@/lib/audit-log";
import { checkRateLimit, getClientIp }     from "@/lib/rate-limit";

const STATE_COOKIE    = "oidc_state";
const NONCE_COOKIE    = "oidc_nonce";
const PROVIDER_COOKIE = "oidc_pid";

function clearOidcCookies(res: NextResponse) {
  const clear = `; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
  res.headers.append("Set-Cookie", `${STATE_COOKIE}=${clear}`);
  res.headers.append("Set-Cookie", `${NONCE_COOKIE}=${clear}`);
  res.headers.append("Set-Cookie", `${PROVIDER_COOKIE}=${clear}`);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "oidc-callback", "submit");
  if (rl) return rl;

  const { searchParams } = new URL(req.url);
  const code             = searchParams.get("code");
  const stateParam       = searchParams.get("state");
  const errorParam       = searchParams.get("error");

  /* IdP-side error (e.g. user denied) */
  if (errorParam) {
    const res = NextResponse.redirect(new URL("/auth/login?error=oidc_denied", req.url));
    clearOidcCookies(res);
    return res;
  }

  if (!code || !stateParam) {
    const res = NextResponse.redirect(new URL("/auth/login?error=invalid_callback", req.url));
    clearOidcCookies(res);
    return res;
  }

  /* Read cookies */
  const storedState  = req.cookies.get(STATE_COOKIE)?.value  ?? "";
  const storedNonce  = req.cookies.get(NONCE_COOKIE)?.value  ?? "";
  const providerId   = req.cookies.get(PROVIDER_COOKIE)?.value ?? "";

  /* CSRF state check */
  if (!storedState || stateParam !== storedState) {
    const res = NextResponse.redirect(new URL("/auth/login?error=state_mismatch", req.url));
    clearOidcCookies(res);
    return res;
  }

  if (!providerId) {
    const res = NextResponse.redirect(new URL("/auth/login?error=invalid_callback", req.url));
    clearOidcCookies(res);
    return res;
  }

  try {
    const provider = await prisma.identityProvider.findFirst({
      where: { id: providerId, provider_type: "OIDC", enabled: true },
    });

    if (!provider || !provider.oidc_issuer_url || !provider.oidc_client_id || !provider.oidc_client_secret) {
      const res = NextResponse.redirect(new URL("/auth/login?error=provider_not_configured", req.url));
      clearOidcCookies(res);
      return res;
    }

    const authSettings = await prisma.companyAuthSettings.findUnique({
      where: { company_id: provider.company_id },
    });
    if (!authSettings?.allow_oidc_login) {
      const res = NextResponse.redirect(new URL("/auth/login?error=oidc_not_enabled", req.url));
      clearOidcCookies(res);
      return res;
    }

    const baseUrl     = new URL(req.url).origin;
    const callbackUrl = `${baseUrl}/api/auth/oidc/callback`;

    const oidcConfig = {
      issuerUrl:    provider.oidc_issuer_url,
      discoveryUrl: provider.oidc_discovery_url ?? undefined,
      clientId:     provider.oidc_client_id,
      clientSecret: provider.oidc_client_secret,
      callbackUrl,
      scopes:       provider.scopes ?? "openid profile email",
    };

    /* Exchange code for tokens */
    const tokenSet = await exchangeCode(oidcConfig, code);

    /* Validate ID token — signature, issuer, audience, expiry, nonce */
    const claims = await validateIdToken(oidcConfig, tokenSet.id_token, storedNonce);

    const email       = claims.email;
    const displayName = claims.name
      ?? (claims.givenName && claims.familyName ? `${claims.givenName} ${claims.familyName}` : undefined)
      ?? email.split("@")[0];

    /* Find or create app user */
    let appUser = await prisma.user.findUnique({ where: { email } });

    if (appUser) {
      if (appUser.auth_provider === "LOCAL" && appUser.company_id !== provider.company_id) {
        const res = NextResponse.redirect(new URL("/auth/login?error=company_mismatch", req.url));
        clearOidcCookies(res);
        return res;
      }
      if (!appUser.is_active) {
        const res = NextResponse.redirect(new URL("/auth/login?error=account_disabled", req.url));
        clearOidcCookies(res);
        return res;
      }
      appUser = await prisma.user.update({
        where: { id: appUser.id },
        data: {
          name:             displayName,
          external_user_id: claims.sub || undefined,
          last_sync_at:     new Date(),
        },
      });
    } else {
      if (!authSettings.auto_import_external_users) {
        const res = NextResponse.redirect(new URL("/auth/login?error=auto_import_disabled", req.url));
        clearOidcCookies(res);
        return res;
      }
      appUser = await prisma.user.create({
        data: {
          email,
          name:             displayName,
          password_hash:    "",
          role:             "USER",
          company_id:       provider.company_id,
          is_active:        true,
          auth_provider:    "OIDC",
          external_user_id: claims.sub || undefined,
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
        description: `Auto-imported OIDC user: ${email} via provider ${provider.name}`,
      });
    }

    void logAudit({
      company_id:  provider.company_id,
      user_id:     appUser.id,
      action:      "LOGIN_SUCCESS",
      module:      "AUTH",
      entity_type: "user",
      entity_id:   appUser.id,
      description: `OIDC login via ${provider.name}`,
    });

    const sessionRes = await createSessionResponse(req, {
      id:         appUser.id,
      email:      appUser.email,
      role:       appUser.role,
      company_id: appUser.company_id,
    }, "/dashboard");

    clearOidcCookies(sessionRes);
    return sessionRes;

  } catch (e) {
    logInternalError(e, { route: "GET /api/auth/oidc/callback" });
    const res = NextResponse.redirect(new URL("/auth/login?error=oidc_auth_failed", req.url));
    clearOidcCookies(res);
    return res;
  }
}

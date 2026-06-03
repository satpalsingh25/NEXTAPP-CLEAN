import { NextRequest, NextResponse }    from "next/server";
import { prisma }                        from "@/lib/prisma";
import { exchangeCodeForTokens, validateIdToken } from "@/lib/auth-providers/azure-ad-client";
import { createSessionResponse }         from "@/lib/auth-session";
import { resolveMappedRole }             from "@/lib/auth-providers/azure/sync";
import { logAudit }                      from "@/lib/audit-log";
import { logInternalError }              from "@/lib/error-log";
import { generateRequestId }             from "@/lib/api-response";
import { getClientIp }                   from "@/lib/rate-limit";
import type { Role }                     from "@prisma/client";

/**
 * GET /api/auth/azure/callback
 *
 * Microsoft OAuth 2.0 callback handler.
 *
 * Security checks performed in order:
 *   1. Error from Microsoft (user denied, misconfigured app, etc.)
 *   2. CSRF state validation
 *   3. Provider lookup from state
 *   4. Token exchange with Microsoft
 *   5. id_token validation (signature, issuer, audience, tenant, nonce)
 *   6. Company isolation — tenant_id must match the stored provider
 *   7. User lookup → link existing OR auto-create
 *   8. Session + JWT issuance
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ip = getClientIp(req);

  /* ── 1. Check for Microsoft error response ───────────────────────── */
  const msError = searchParams.get("error");
  if (msError) {
    const desc = searchParams.get("error_description") ?? msError;
    logInternalError(new Error(desc), { route: "GET /api/auth/azure/callback", meta: { msError } });
    return NextResponse.redirect(new URL("/auth/login?error=azure_denied", req.url));
  }

  const code  = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_callback", req.url));
  }

  /* ── 2. CSRF state validation ────────────────────────────────────── */
  const storedState = req.cookies.get("az_state")?.value;
  const storedNonce = req.cookies.get("az_nonce")?.value;

  if (!storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/auth/login?error=state_mismatch", req.url));
  }
  if (!storedNonce) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_nonce", req.url));
  }

  /* ── 3. Extract provider_id from state ───────────────────────────── */
  const colonIdx  = state.indexOf(":");
  const providerId = colonIdx >= 0 ? state.slice(colonIdx + 1) : null;

  if (!providerId) {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_state", req.url));
  }

  const provider = await prisma.identityProvider.findFirst({
    where: {
      id:            providerId,
      provider_type: "AZURE_AD",
      enabled:       true,
    },
    select: {
      id:            true,
      company_id:    true,
      client_id:     true,
      client_secret: true,
      tenant_id:     true,
      redirect_uri:  true,
      scopes:        true,
    },
  });

  if (!provider || !provider.client_id || !provider.client_secret ||
      !provider.tenant_id || !provider.redirect_uri) {
    return NextResponse.redirect(new URL("/auth/login?error=provider_unavailable", req.url));
  }

  const config = {
    clientId:     provider.client_id,
    clientSecret: provider.client_secret,
    tenantId:     provider.tenant_id,
    redirectUri:  provider.redirect_uri,
    scopes:       provider.scopes || "openid profile email User.Read",
  };

  const requestId = generateRequestId();

  try {
    /* ── 4. Exchange code for tokens ─────────────────────────────── */
    const tokens = await exchangeCodeForTokens(code, config);

    if (!tokens.id_token) {
      throw new Error("Microsoft did not return an id_token");
    }

    /* ── 5. Validate id_token (sig, issuer, audience, tenant, nonce) */
    const claims = await validateIdToken(tokens.id_token, config, storedNonce);

    /* ── 6. Resolve email from claims ────────────────────────────── */
    const email =
      claims.email ??
      claims.preferred_username ??
      null;

    if (!email || !email.includes("@")) {
      throw new Error("id_token does not contain a valid email claim");
    }

    /* ── 7. User lookup / auto-creation ──────────────────────────── */
    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      /* Existing user — must belong to the same company as the provider */
      if (user.company_id !== provider.company_id) {
        void logAudit({
          company_id:  provider.company_id,
          action:      "AZURE_LOGIN_CROSS_COMPANY",
          module:      "AUTH",
          entity_type: "user",
          description: `Cross-company Azure login attempt from IP ${ip} for email ${email}`,
        });
        return NextResponse.redirect(new URL("/auth/login?error=company_mismatch", req.url));
      }

      if (!user.is_active) {
        return NextResponse.redirect(new URL("/auth/login?error=account_disabled", req.url));
      }

      /* Link Azure identity if not already linked */
      const groupMappings = await prisma.identityGroupMapping.findMany({
        where: { company_id: provider.company_id, identity_provider_id: provider.id, enabled: true, auto_assign_role: true },
      });
      const userGroupIds = (user.external_group_ids as string[] | null) ?? [];
      const mappedRole   = resolveMappedRole(userGroupIds, groupMappings) as Role | null;

      const updateData: Record<string, unknown> = {};
      if (!user.external_user_id) {
        updateData.auth_provider    = "AZURE_AD";
        updateData.external_user_id = claims.oid;
        updateData.is_external_user = true;
      }
      updateData.last_sync_at = new Date();
      if (mappedRole && mappedRole !== user.role) {
        updateData.role = mappedRole;
        void logAudit({
          company_id:  user.company_id,
          user_id:     user.id,
          action:      "AZURE_AUTO_ROLE_ASSIGNED",
          module:      "AUTH",
          entity_type: "user",
          entity_id:   user.id,
          description: `Auto-assigned role ${mappedRole} via Azure group mapping`,
        });
      }
      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({ where: { id: user.id }, data: updateData });
      }

      void logAudit({
        company_id:  user.company_id,
        user_id:     user.id,
        action:      "AZURE_LOGIN_SUCCESS",
        module:      "AUTH",
        entity_type: "user",
        entity_id:   user.id,
        description: `Azure AD login from IP ${ip}`,
      });

    } else {
      /* New user — auto-create under the provider's company */

      /* Check if the company allows auto-import */
      const authSettings = await prisma.companyAuthSettings.findUnique({
        where: { company_id: provider.company_id },
      });

      if (!authSettings?.auto_import_external_users) {
        void logAudit({
          company_id:  provider.company_id,
          action:      "AZURE_LOGIN_AUTO_IMPORT_DENIED",
          module:      "AUTH",
          entity_type: "user",
          description: `Auto-import denied for ${email} — not permitted by company settings`,
        });
        return NextResponse.redirect(new URL("/auth/login?error=auto_import_disabled", req.url));
      }

      user = await prisma.user.create({
        data: {
          email,
          name:             claims.name ?? email.split("@")[0],
          password_hash:    "",               // no local password for Azure users
          role:             "USER",
          company_id:       provider.company_id,
          is_active:        true,
          auth_provider:    "AZURE_AD",
          external_user_id: claims.oid,
          is_external_user: true,
        },
      });

      void logAudit({
        company_id:  provider.company_id,
        user_id:     user.id,
        action:      "AZURE_USER_AUTO_CREATED",
        module:      "AUTH",
        entity_type: "user",
        entity_id:   user.id,
        description: `Auto-created Azure AD user ${email} from IP ${ip}`,
      });
    }

    /* ── 8. Issue JWT + session — clear OAuth cookies in response ─── */
    const sessionResponse = await createSessionResponse(
      req,
      {
        id:         user.id,
        email:      user.email,
        role:       user.role,
        company_id: user.company_id,
      },
      "/dashboard",
    );

    /* Clear short-lived OAuth state cookies */
    sessionResponse.cookies.delete("az_state");
    sessionResponse.cookies.delete("az_nonce");

    return sessionResponse;

  } catch (err) {
    logInternalError(err, {
      route:      "GET /api/auth/azure/callback",
      company_id: provider.company_id,
      request_id: requestId,
    });

    void logAudit({
      company_id:  provider.company_id,
      action:      "AZURE_LOGIN_FAILED",
      module:      "AUTH",
      entity_type: "identity_provider",
      entity_id:   provider.id,
      description: `Azure AD login failed from IP ${ip}: ${(err as Error).message}`,
    });

    return NextResponse.redirect(new URL("/auth/login?error=azure_auth_failed", req.url));
  }
}

/**
 * POST /api/auth/ldap/login
 * Public endpoint — authenticates a user via LDAP/AD credentials.
 * Rate-limited, finds the company LDAP provider, verifies via bind,
 * then creates a JWT session via the shared createSessionResponse helper.
 */
import { NextRequest, NextResponse }                  from "next/server";
import { prisma }                                      from "@/lib/prisma";
import { createSessionResponse }                       from "@/lib/auth-session";
import { errorResponse, generateRequestId }            from "@/lib/api-response";
import { logInternalError }                            from "@/lib/error-log";
import { checkRateLimit, getClientIp }                 from "@/lib/rate-limit";
import { validateEmail, validateRequiredString, ValidationError } from "@/lib/validation";
import { findLdapUserByEmail, verifyLdapUserPassword } from "@/lib/auth-providers/ldap/client";
import { resolveLdapMappedRole }                       from "@/lib/auth-providers/ldap/sync";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  const ctx       = { route: "POST /api/auth/ldap/login", requestId };
  const ip        = getClientIp(req);

  /* Rate limit */
  const rl = checkRateLimit(ip, "ldap-login", "login");
  if (rl) return rl;

  let body: unknown;
  try { body = await req.json(); } catch {
    return errorResponse("Invalid request body.", 400, requestId);
  }

  /* Validate inputs */
  let email: string;
  let password: string;
  try {
    email    = validateEmail((body as Record<string, unknown>)?.email);
    password = validateRequiredString((body as Record<string, unknown>)?.password, 256, "Password");
  } catch (e) {
    if (e instanceof ValidationError) return errorResponse(e.message, e.status, requestId);
    throw e;
  }

  const normalEmail = email.toLowerCase().trim();

  try {
    /* ── 1. Find an existing app user (to get company context) ────────── */
    const appUser = await prisma.user.findUnique({ where: { email: normalEmail } });

    /* ── 2. Find the LDAP provider ───────────────────────────────────── */
    let ldapProvider = null;
    if (appUser) {
      ldapProvider = await prisma.identityProvider.findFirst({
        where: { company_id: appUser.company_id, provider_type: "LDAP", enabled: true },
      });
    }
    /* Fallback: try any active LDAP provider (new user auto-import) */
    if (!ldapProvider) {
      ldapProvider = await prisma.identityProvider.findFirst({
        where: { provider_type: "LDAP", enabled: true },
      });
    }

    if (!ldapProvider) {
      return errorResponse("Invalid credentials.", 401, requestId);
    }

    /* ── 3. Check company auth settings ──────────────────────────────── */
    const authSettings = await prisma.companyAuthSettings.findUnique({
      where: { company_id: ldapProvider.company_id },
    });
    if (!authSettings?.allow_ldap_login) {
      return errorResponse("Invalid credentials.", 401, requestId);
    }

    /* ── 4. Validate LDAP config completeness ────────────────────────── */
    if (!ldapProvider.ldap_url || !ldapProvider.ldap_bind_dn || !ldapProvider.ldap_bind_password || !ldapProvider.ldap_base_dn) {
      return errorResponse("Invalid credentials.", 401, requestId);
    }
    const config = {
      url:          ldapProvider.ldap_url,
      bindDn:       ldapProvider.ldap_bind_dn,
      bindPassword: ldapProvider.ldap_bind_password,
      baseDn:       ldapProvider.ldap_base_dn,
      userFilter:   ldapProvider.ldap_user_filter  ?? "(objectClass=person)",
      groupFilter:  ldapProvider.ldap_group_filter ?? "(objectClass=group)",
      tlsEnabled:   ldapProvider.ldap_tls_enabled  ?? false,
    };

    /* ── 5. Find user in LDAP directory ──────────────────────────────── */
    const ldapUser = await findLdapUserByEmail(config, normalEmail);
    if (!ldapUser) {
      return errorResponse("Invalid credentials.", 401, requestId);
    }

    /* ── 6. Verify password via user bind ────────────────────────────── */
    const valid = await verifyLdapUserPassword(config, ldapUser.dn, password);
    if (!valid) {
      return errorResponse("Invalid credentials.", 401, requestId);
    }

    /* ── 7. Check AD account disabled flag (userAccountControl bit 2) ── */
    if (ldapUser.userAccountControl) {
      const uac = parseInt(ldapUser.userAccountControl, 10);
      if (!isNaN(uac) && (uac & 2) !== 0) {
        return errorResponse("Your account has been disabled. Contact your administrator.", 403, requestId);
      }
    }

    /* ── 8. Resolve role from group mappings ─────────────────────────── */
    const groupMappings = await prisma.identityGroupMapping.findMany({
      where: {
        company_id:           ldapProvider.company_id,
        identity_provider_id: ldapProvider.id,
        enabled:              true,
        auto_assign_role:     true,
      },
    });
    const memberOf   = ldapUser.memberOf ?? [];
    const mappedRole = resolveLdapMappedRole(memberOf, groupMappings);

    /* ── 9. Create or update the app user ────────────────────────────── */
    const displayName = ldapUser.displayName ?? ldapUser.cn ?? normalEmail.split("@")[0];
    const externalId  = ldapUser.objectGUID  ?? ldapUser.dn;

    let finalUser;

    if (appUser) {
      if (appUser.auth_provider === "LOCAL") {
        return errorResponse("Invalid credentials.", 401, requestId);
      }
      if (!appUser.is_active) {
        return errorResponse("Your account has been disabled. Contact your administrator.", 403, requestId);
      }
      finalUser = await prisma.user.update({
        where: { id: appUser.id },
        data: {
          name:               displayName,
          external_user_id:   externalId,
          external_group_ids: memberOf,
          last_sync_at:       new Date(),
          ...(mappedRole ? { role: mappedRole } : {}),
        },
      });
    } else {
      if (!authSettings.auto_import_external_users) {
        return errorResponse("Your account does not exist here. Contact your administrator.", 403, requestId);
      }
      finalUser = await prisma.user.create({
        data: {
          email:              normalEmail,
          name:               displayName,
          password_hash:      "",
          role:               mappedRole ?? "USER",
          company_id:         ldapProvider.company_id,
          is_active:          true,
          auth_provider:      "LDAP",
          external_user_id:   externalId,
          external_group_ids: memberOf,
          is_external_user:   true,
          last_sync_at:       new Date(),
        },
      });
    }

    /* ── 10. Create JWT session ──────────────────────────────────────── */
    return createSessionResponse(req, {
      id:         finalUser.id,
      email:      finalUser.email,
      role:       finalUser.role,
      company_id: finalUser.company_id,
    });

  } catch (e) {
    logInternalError(e, ctx);
    return errorResponse("An error occurred. Please try again.", 500, requestId);
  }
}

import { NextRequest, NextResponse }       from "next/server";
import { prisma }                           from "@/lib/prisma";
import { requireRole, ADMIN_ONLY }          from "@/lib/auth.server";
import { logAudit }                         from "@/lib/audit-log";
import { checkRateLimit }                   from "@/lib/rate-limit";
import { errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError }                 from "@/lib/error-log";
import { validateRequiredString }           from "@/lib/validation";
import { AuthProviderType }                 from "@prisma/client";

const SAFE_SELECT = {
  id:                  true,
  name:                true,
  provider_type:       true,
  enabled:             true,
  /* Azure AD / OIDC shared */
  client_id:           true,
  tenant_id:           true,
  redirect_uri:        true,
  scopes:              true,
  /* LDAP */
  ldap_url:            true,
  ldap_bind_dn:        true,
  ldap_base_dn:        true,
  ldap_user_filter:    true,
  ldap_group_filter:   true,
  ldap_tls_enabled:    true,
  /* SAML 2.0 */
  saml_entry_point:    true,
  saml_issuer:         true,
  saml_logout_url:     true,
  /* saml_certificate intentionally excluded (IdP cert, large + sensitive) */
  /* OIDC */
  oidc_issuer_url:     true,
  oidc_client_id:      true,
  oidc_discovery_url:  true,
  /* oidc_client_secret intentionally excluded */
  created_at:          true,
  updated_at:          true,
};

/* ── GET /api/protected/identity-providers ─────────────────────────── */
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  try {
    const providers = await prisma.identityProvider.findMany({
      where:   { company_id: auth.user.company_id },
      orderBy: { created_at: "desc" },
      select:  SAFE_SELECT,
    });
    return NextResponse.json(providers);
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: "GET /api/protected/identity-providers", user_id: auth.user.user_id, company_id: auth.user.company_id, request_id: requestId });
    return errorResponse("Failed to load identity providers.", 500, requestId);
  }
}

/* ── POST /api/protected/identity-providers ────────────────────────── */
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  const rl = checkRateLimit(user_id, "identity-providers-create", "write");
  if (rl) return rl;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const name = validateRequiredString(body.name, 128, "Name");

    const provider_type = body.provider_type as AuthProviderType;
    if (!Object.values(AuthProviderType).includes(provider_type)) {
      return NextResponse.json({ error: "Invalid provider type." }, { status: 400 });
    }

    const provider = await prisma.identityProvider.create({
      data: {
        company_id,
        provider_type,
        name,
        enabled:             true,
        /* Azure AD shared */
        client_id:           (body.client_id as string)    || null,
        client_secret:       (body.client_secret as string) || null,
        tenant_id:           (body.tenant_id as string)    || null,
        redirect_uri:        (body.redirect_uri as string) || null,
        scopes:              (body.scopes as string)        || null,
        /* LDAP */
        ldap_url:            (body.ldap_url as string)            || null,
        ldap_bind_dn:        (body.ldap_bind_dn as string)        || null,
        ldap_bind_password:  (body.ldap_bind_password as string)  || null,
        ldap_base_dn:        (body.ldap_base_dn as string)        || null,
        ldap_user_filter:    (body.ldap_user_filter as string)    || null,
        ldap_group_filter:   (body.ldap_group_filter as string)   || null,
        ldap_tls_enabled:    typeof body.ldap_tls_enabled === "boolean" ? body.ldap_tls_enabled : false,
        /* SAML 2.0 */
        saml_entry_point:    (body.saml_entry_point as string)  || null,
        saml_issuer:         (body.saml_issuer as string)       || null,
        saml_certificate:    (body.saml_certificate as string)  || null,
        saml_logout_url:     (body.saml_logout_url as string)   || null,
        /* Generic OIDC */
        oidc_issuer_url:     (body.oidc_issuer_url as string)    || null,
        oidc_client_id:      (body.oidc_client_id as string)     || null,
        oidc_client_secret:  (body.oidc_client_secret as string) || null,
        oidc_discovery_url:  (body.oidc_discovery_url as string) || null,
      },
      select: SAFE_SELECT,
    });

    void logAudit({
      company_id,
      user_id,
      action:      "IDENTITY_PROVIDER_CREATE",
      module:      "ADMIN",
      entity_type: "identity_provider",
      entity_id:   provider.id,
      description: `Created ${provider_type} identity provider: ${name}`,
    });

    return NextResponse.json(provider, { status: 201 });
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: "POST /api/protected/identity-providers", user_id, company_id, request_id: requestId });
    return errorResponse("Failed to create identity provider.", 500, requestId);
  }
}

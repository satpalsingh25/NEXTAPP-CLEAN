import { NextRequest, NextResponse }       from "next/server";
import { prisma }                           from "@/lib/prisma";
import { requireRole, ADMIN_ONLY }          from "@/lib/auth.server";
import { logAudit }                         from "@/lib/audit-log";
import { checkRateLimit }                   from "@/lib/rate-limit";
import { errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError }                 from "@/lib/error-log";
import { validateRequiredString }           from "@/lib/validation";

const SAFE_SELECT = {
  id:                  true,
  name:                true,
  provider_type:       true,
  enabled:             true,
  /* Azure AD shared */
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
  /* saml_certificate intentionally excluded */
  /* OIDC */
  oidc_issuer_url:     true,
  oidc_client_id:      true,
  oidc_discovery_url:  true,
  /* oidc_client_secret intentionally excluded */
  created_at:          true,
  updated_at:          true,
};

type RouteParams = { params: Promise<{ id: string }> };

/* ── GET /api/protected/identity-providers/[id] ────────────────────── */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const provider = await prisma.identityProvider.findFirst({
      where:  { id, company_id: auth.user.company_id },
      select: SAFE_SELECT,
    });
    if (!provider) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(provider);
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: `GET /api/protected/identity-providers/${id}`, user_id: auth.user.user_id, company_id: auth.user.company_id, request_id: requestId });
    return errorResponse("Failed to load provider.", 500, requestId);
  }
}

/* ── PUT /api/protected/identity-providers/[id] ────────────────────── */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  const { id } = await params;

  const rl = checkRateLimit(user_id, `identity-providers-update-${id}`, "write");
  if (rl) return rl;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    /* Verify provider belongs to this company */
    const existing = await prisma.identityProvider.findFirst({
      where:  { id, company_id },
      select: { id: true, name: true, provider_type: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const name = body.name !== undefined
      ? validateRequiredString(body.name, 128, "Name")
      : existing.name;

    /* Build update payload — only include secrets when explicitly provided (non-empty) */
    const updateData: Record<string, unknown> = {
      name,
      /* Azure AD shared */
      client_id:          body.client_id    !== undefined ? ((body.client_id as string)    || null) : undefined,
      tenant_id:          body.tenant_id    !== undefined ? ((body.tenant_id as string)    || null) : undefined,
      redirect_uri:       body.redirect_uri !== undefined ? ((body.redirect_uri as string) || null) : undefined,
      scopes:             body.scopes       !== undefined ? ((body.scopes as string)       || null) : undefined,
      /* LDAP */
      ldap_url:           body.ldap_url          !== undefined ? ((body.ldap_url as string)          || null) : undefined,
      ldap_bind_dn:       body.ldap_bind_dn      !== undefined ? ((body.ldap_bind_dn as string)      || null) : undefined,
      ldap_base_dn:       body.ldap_base_dn      !== undefined ? ((body.ldap_base_dn as string)      || null) : undefined,
      ldap_user_filter:   body.ldap_user_filter  !== undefined ? ((body.ldap_user_filter as string)  || null) : undefined,
      ldap_group_filter:  body.ldap_group_filter !== undefined ? ((body.ldap_group_filter as string) || null) : undefined,
      ldap_tls_enabled:   typeof body.ldap_tls_enabled === "boolean" ? body.ldap_tls_enabled : undefined,
      /* SAML 2.0 */
      saml_entry_point:   body.saml_entry_point !== undefined ? ((body.saml_entry_point as string) || null) : undefined,
      saml_issuer:        body.saml_issuer      !== undefined ? ((body.saml_issuer as string)      || null) : undefined,
      saml_logout_url:    body.saml_logout_url  !== undefined ? ((body.saml_logout_url as string)  || null) : undefined,
      /* OIDC */
      oidc_issuer_url:    body.oidc_issuer_url    !== undefined ? ((body.oidc_issuer_url as string)    || null) : undefined,
      oidc_client_id:     body.oidc_client_id     !== undefined ? ((body.oidc_client_id as string)     || null) : undefined,
      oidc_discovery_url: body.oidc_discovery_url !== undefined ? ((body.oidc_discovery_url as string) || null) : undefined,
    };

    /* Only update secrets when explicitly provided and non-empty */
    if (body.client_secret && typeof body.client_secret === "string" && body.client_secret.trim()) {
      updateData.client_secret = body.client_secret.trim();
    }
    if (body.ldap_bind_password && typeof body.ldap_bind_password === "string" && body.ldap_bind_password.trim()) {
      updateData.ldap_bind_password = body.ldap_bind_password.trim();
    }
    if (body.saml_certificate && typeof body.saml_certificate === "string" && body.saml_certificate.trim()) {
      updateData.saml_certificate = body.saml_certificate.trim();
    }
    if (body.oidc_client_secret && typeof body.oidc_client_secret === "string" && body.oidc_client_secret.trim()) {
      updateData.oidc_client_secret = body.oidc_client_secret.trim();
    }

    if (typeof body.enabled === "boolean") {
      updateData.enabled = body.enabled;
    }

    const provider = await prisma.identityProvider.update({
      where:  { id },
      data:   updateData,
      select: SAFE_SELECT,
    });

    void logAudit({
      company_id,
      user_id,
      action:      "IDENTITY_PROVIDER_UPDATE",
      module:      "ADMIN",
      entity_type: "identity_provider",
      entity_id:   provider.id,
      description: `Updated ${existing.provider_type} provider: ${name}`,
    });

    return NextResponse.json(provider);
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: `PUT /api/protected/identity-providers/${id}`, user_id, company_id, request_id: requestId });
    return errorResponse("Failed to update provider.", 500, requestId);
  }
}

/* ── PATCH /api/protected/identity-providers/[id] — toggle enabled ─── */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  const { id } = await params;

  let body: { enabled?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const existing = await prisma.identityProvider.findFirst({
      where: { id, company_id },
      select: { id: true, name: true, provider_type: true, enabled: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const enabled = typeof body.enabled === "boolean" ? body.enabled : !existing.enabled;

    const provider = await prisma.identityProvider.update({
      where:  { id },
      data:   { enabled },
      select: SAFE_SELECT,
    });

    void logAudit({
      company_id,
      user_id,
      action:      enabled ? "IDENTITY_PROVIDER_ENABLED" : "IDENTITY_PROVIDER_DISABLED",
      module:      "ADMIN",
      entity_type: "identity_provider",
      entity_id:   id,
      description: `${enabled ? "Enabled" : "Disabled"} ${existing.provider_type} provider: ${existing.name}`,
    });

    return NextResponse.json(provider);
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: `PATCH /api/protected/identity-providers/${id}`, user_id, company_id, request_id: requestId });
    return errorResponse("Failed to toggle provider.", 500, requestId);
  }
}

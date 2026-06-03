import { NextRequest, NextResponse }  from "next/server";
import { prisma }                      from "@/lib/prisma";
import { requireRole, ADMIN_ONLY }     from "@/lib/auth.server";
import { logAudit }                    from "@/lib/audit-log";
import { checkRateLimit }              from "@/lib/rate-limit";
import { errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError }            from "@/lib/error-log";

/* ── GET /api/protected/auth-settings ──────────────────────────────── */
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  try {
    const settings = await prisma.companyAuthSettings.findUnique({
      where: { company_id },
    });

    /* Return defaults when no row exists yet */
    if (!settings) {
      return NextResponse.json({
        allow_local_login:          true,
        allow_azure_login:          false,
        allow_google_login:         false,
        allow_ldap_login:           false,
        allow_saml_login:           false,
        allow_oidc_login:           false,
        auto_import_external_users: false,
        auto_disable_removed_users: false,
      });
    }

    return NextResponse.json(settings);
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, {
      route:      "GET /api/protected/auth-settings",
      user_id:    auth.user.user_id,
      company_id: auth.user.company_id,
      request_id: requestId,
    });
    return errorResponse("Failed to load authentication settings.", 500, requestId);
  }
}

/* ── PUT /api/protected/auth-settings ──────────────────────────────── */
export async function PUT(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  const rl = checkRateLimit(user_id, "auth-settings-update", "write");
  if (rl) return rl;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const boolField = (key: string, fallback: boolean): boolean =>
    typeof body[key] === "boolean" ? (body[key] as boolean) : fallback;

  try {
    const data = {
      allow_local_login:          boolField("allow_local_login", true),
      allow_azure_login:          boolField("allow_azure_login", false),
      allow_google_login:         boolField("allow_google_login", false),
      allow_ldap_login:           boolField("allow_ldap_login", false),
      allow_saml_login:           boolField("allow_saml_login", false),
      allow_oidc_login:           boolField("allow_oidc_login", false),
      auto_import_external_users: boolField("auto_import_external_users", false),
      auto_disable_removed_users: boolField("auto_disable_removed_users", false),
    };

    /* Ensure local login cannot be disabled when it is the only method */
    const anyExternal =
      data.allow_azure_login  ||
      data.allow_google_login ||
      data.allow_ldap_login   ||
      data.allow_saml_login   ||
      data.allow_oidc_login;

    if (!data.allow_local_login && !anyExternal) {
      return NextResponse.json(
        { error: "At least one login method must remain enabled." },
        { status: 400 },
      );
    }

    const settings = await prisma.companyAuthSettings.upsert({
      where:  { company_id },
      update: data,
      create: { company_id, ...data },
    });

    void logAudit({
      company_id,
      user_id,
      action:      "AUTH_SETTINGS_UPDATE",
      module:      "ADMIN",
      entity_type: "company_auth_settings",
      entity_id:   settings.id,
      description: "Updated company authentication settings",
    });

    return NextResponse.json(settings);
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, {
      route:      "PUT /api/protected/auth-settings",
      user_id:    auth.user.user_id,
      company_id: auth.user.company_id,
      request_id: requestId,
    });
    return errorResponse("Failed to update authentication settings.", 500, requestId);
  }
}

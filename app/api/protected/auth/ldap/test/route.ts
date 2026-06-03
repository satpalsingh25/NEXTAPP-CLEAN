/**
 * POST /api/protected/auth/ldap/test
 * Tests an LDAP provider connection (service bind only).
 * Requires ADMIN or SUPER_ADMIN.
 */
import { NextRequest, NextResponse }        from "next/server";
import { requireRole, ADMIN_ONLY }          from "@/lib/auth.server";
import { successResponse, errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError }                 from "@/lib/error-log";
import { prisma }                           from "@/lib/prisma";
import { testLdapConnection }              from "@/lib/auth-providers/ldap/client";
import { validateRequiredString }           from "@/lib/validation";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  const ctx       = { route: "POST /api/protected/auth/ldap/test", requestId };

  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try { body = await req.json(); } catch {
    return errorResponse("Invalid request body.", 400, requestId);
  }
  const { provider_id } = body as Record<string, unknown>;

  try { validateRequiredString(provider_id, 64, "provider_id"); } catch (e: unknown) {
    return errorResponse((e as { message: string }).message, 400, requestId);
  }

  try {
    /* Load provider — scoped to the caller's company */
    const companyId = auth.user.role === "SUPER_ADMIN"
      ? undefined
      : auth.user.company_id;

    const provider = await prisma.identityProvider.findFirst({
      where: {
        id:            provider_id as string,
        provider_type: "LDAP",
        ...(companyId ? { company_id: companyId } : {}),
      },
    });

    if (!provider) {
      return errorResponse("LDAP provider not found.", 404, requestId);
    }

    if (!provider.ldap_url || !provider.ldap_bind_dn || !provider.ldap_bind_password || !provider.ldap_base_dn) {
      return errorResponse("LDAP provider is missing required fields (url, bind DN, bind password, base DN).", 400, requestId);
    }

    const result = await testLdapConnection({
      url:          provider.ldap_url,
      bindDn:       provider.ldap_bind_dn,
      bindPassword: provider.ldap_bind_password,
      baseDn:       provider.ldap_base_dn,
      userFilter:   provider.ldap_user_filter  ?? "(objectClass=person)",
      groupFilter:  provider.ldap_group_filter ?? "(objectClass=group)",
      tlsEnabled:   provider.ldap_tls_enabled  ?? false,
    });

    return successResponse(result, result.success ? 200 : 400, requestId);
  } catch (e) {
    logInternalError(e, ctx);
    return errorResponse("An error occurred during connection test.", 500, requestId);
  }
}

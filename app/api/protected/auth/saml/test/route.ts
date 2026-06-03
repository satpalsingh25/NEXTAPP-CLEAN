/**
 * POST /api/protected/auth/saml/test
 * Tests a SAML provider configuration — validates the certificate and
 * checks reachability of the entry point URL.
 * Requires ADMIN or SUPER_ADMIN.
 */
import { NextRequest, NextResponse }        from "next/server";
import { requireRole, ADMIN_ONLY }          from "@/lib/auth.server";
import { successResponse, errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError }                 from "@/lib/error-log";
import { prisma }                           from "@/lib/prisma";
import { testSamlConnection }               from "@/lib/auth-providers/saml/client";
import { ValidationError, validateRequiredString } from "@/lib/validation";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  const ctx       = { route: "POST /api/protected/auth/saml/test", requestId };

  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try { body = await req.json(); } catch {
    return errorResponse("Invalid request body.", 400, requestId);
  }
  const { provider_id } = body as Record<string, unknown>;

  try { validateRequiredString(provider_id, 64, "provider_id"); } catch (e) {
    if (e instanceof ValidationError) return errorResponse(e.message, 400, requestId);
    throw e;
  }

  try {
    const companyId = auth.user.role === "SUPER_ADMIN" ? undefined : auth.user.company_id;
    const provider  = await prisma.identityProvider.findFirst({
      where: { id: provider_id as string, provider_type: "SAML", ...(companyId ? { company_id: companyId } : {}) },
    });
    if (!provider) return errorResponse("SAML provider not found.", 404, requestId);

    if (!provider.saml_entry_point || !provider.saml_issuer || !provider.saml_certificate) {
      return errorResponse("SAML provider is missing required fields (entry point, issuer, certificate).", 400, requestId);
    }

    const result = await testSamlConnection({
      entryPoint:  provider.saml_entry_point,
      issuer:      provider.saml_issuer,
      certificate: provider.saml_certificate,
      callbackUrl: `${req.headers.get("origin") ?? ""}/api/auth/saml/callback`,
      logoutUrl:   provider.saml_logout_url ?? undefined,
    });

    return successResponse(result, result.success ? 200 : 400, requestId);
  } catch (e) {
    logInternalError(e, ctx);
    return errorResponse("An error occurred during SAML connection test.", 500, requestId);
  }
}

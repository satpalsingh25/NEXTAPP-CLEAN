/**
 * POST /api/protected/auth/oidc/test
 * Tests an OIDC provider — fetches the discovery document and validates it.
 * Requires ADMIN or SUPER_ADMIN.
 */
import { NextRequest, NextResponse }        from "next/server";
import { requireRole, ADMIN_ONLY }          from "@/lib/auth.server";
import { successResponse, errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError }                 from "@/lib/error-log";
import { prisma }                           from "@/lib/prisma";
import { testOidcConnection }               from "@/lib/auth-providers/oidc/client";
import { ValidationError, validateRequiredString } from "@/lib/validation";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  const ctx       = { route: "POST /api/protected/auth/oidc/test", requestId };

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
      where: { id: provider_id as string, provider_type: "OIDC", ...(companyId ? { company_id: companyId } : {}) },
    });
    if (!provider) return errorResponse("OIDC provider not found.", 404, requestId);

    if (!provider.oidc_issuer_url && !provider.oidc_discovery_url) {
      return errorResponse("OIDC provider is missing an Issuer URL or Discovery URL.", 400, requestId);
    }
    if (!provider.oidc_client_id) {
      return errorResponse("OIDC provider is missing a Client ID.", 400, requestId);
    }

    const result = await testOidcConnection({
      issuerUrl:    provider.oidc_issuer_url    ?? "",
      discoveryUrl: provider.oidc_discovery_url ?? undefined,
      clientId:     provider.oidc_client_id,
    });

    return successResponse(result, result.success ? 200 : 400, requestId);
  } catch (e) {
    logInternalError(e, ctx);
    return errorResponse("An error occurred during OIDC connection test.", 500, requestId);
  }
}

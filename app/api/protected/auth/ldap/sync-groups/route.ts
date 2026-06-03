/**
 * POST /api/protected/auth/ldap/sync-groups
 * Syncs LDAP group memberships onto application users and applies role mappings.
 * Requires ADMIN or SUPER_ADMIN.
 */
import { NextRequest, NextResponse }        from "next/server";
import { requireRole, ADMIN_ONLY }          from "@/lib/auth.server";
import { successResponse, errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError }                 from "@/lib/error-log";
import { validateRequiredString }           from "@/lib/validation";
import { syncLdapGroups }                   from "@/lib/auth-providers/ldap/sync";
import { prisma }                           from "@/lib/prisma";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  const ctx       = { route: "POST /api/protected/auth/ldap/sync-groups", requestId };

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

    const result = await syncLdapGroups(provider.id, provider.company_id, auth.user.user_id);
    return successResponse(result, 200, requestId);
  } catch (e) {
    logInternalError(e, ctx);
    const msg = (e as Error).message;
    if (msg.startsWith("LDAP provider is missing") || msg.startsWith("LDAP provider not found")) {
      return errorResponse(msg, 400, requestId);
    }
    return errorResponse("Group sync failed. Please try again.", 500, requestId);
  }
}

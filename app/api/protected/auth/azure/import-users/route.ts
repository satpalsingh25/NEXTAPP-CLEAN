import { NextRequest }          from "next/server";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";
import { errorResponse, successResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError }    from "@/lib/error-log";
import { validateUUID }        from "@/lib/validation";
import { syncAzureUsers }      from "@/lib/auth-providers/azure/sync";

/**
 * POST /api/protected/auth/azure/import-users
 * Body: { provider_id: string }
 */
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  const requestId = generateRequestId();

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const providerId = String(body.provider_id ?? "").trim();

    const pidErr = validateUUID(providerId, "provider_id");
    if (pidErr) return errorResponse(pidErr, 400, requestId);

    const result = await syncAzureUsers(providerId, auth.user.company_id, auth.user.user_id);

    return successResponse(result, 200);
  } catch (e) {
    logInternalError(e, {
      route:      "POST /api/protected/auth/azure/import-users",
      company_id: auth.user.company_id,
      user_id:    auth.user.user_id,
      request_id: requestId,
    });
    return errorResponse((e as Error).message, 500, requestId);
  }
}

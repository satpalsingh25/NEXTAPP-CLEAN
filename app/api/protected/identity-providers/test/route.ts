import { NextRequest, NextResponse }       from "next/server";
import { requireRole, ADMIN_ONLY }          from "@/lib/auth.server";
import { testAzureConnection }              from "@/lib/auth-providers/azure-ad-client";
import { checkRateLimit }                   from "@/lib/rate-limit";
import { errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError }                 from "@/lib/error-log";

/**
 * POST /api/protected/identity-providers/test
 *
 * Tests an Azure AD tenant connection by validating the OpenID
 * configuration endpoint.  Does NOT require client_secret.
 *
 * Body: { tenant_id: string }
 */
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(auth.user.user_id, "idp-test", "write");
  if (rl) return rl;

  let body: { tenant_id?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.tenant_id || typeof body.tenant_id !== "string") {
    return NextResponse.json({ error: "tenant_id is required." }, { status: 400 });
  }

  try {
    const result = await testAzureConnection(body.tenant_id.trim());
    return NextResponse.json(result);
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: "POST /api/protected/identity-providers/test", user_id: auth.user.user_id, company_id: auth.user.company_id, request_id: requestId });
    return errorResponse("Connection test failed.", 500, requestId);
  }
}

import { NextRequest, NextResponse }  from "next/server";
import { prisma }                      from "@/lib/prisma";
import { requireRole, ADMIN_ONLY }     from "@/lib/auth.server";
import { errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError }            from "@/lib/error-log";

/* ── GET /api/protected/identity-providers ─────────────────────────── */
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  try {
    const providers = await prisma.identityProvider.findMany({
      where:   { company_id },
      orderBy: { created_at: "desc" },
      select: {
        id:            true,
        name:          true,
        provider_type: true,
        enabled:       true,
        created_at:    true,
        updated_at:    true,
      },
    });

    return NextResponse.json(providers);
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, {
      route:      "GET /api/protected/identity-providers",
      user_id:    auth.user.user_id,
      company_id: auth.user.company_id,
      request_id: requestId,
    });
    return errorResponse("Failed to load identity providers.", 500, requestId);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma }    from "@/lib/prisma";
import jwt           from "jsonwebtoken";
import { logAudit }  from "@/lib/audit-log";
import { getClientIp } from "@/lib/rate-limit";
import { logInternalError } from "@/lib/error-log";

/* ------------------------------------------------------------------ */
/*  POST /api/auth/logout                                               */
/*                                                                      */
/*  Step 7: Proper session destroy + cookie invalidation.               */
/*  Reads session_id from the JWT and marks that UserSession row        */
/*  as inactive so the admin session table stays accurate.             */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  /* Try to read the current token to extract session_id */
  const token = req.cookies.get("token")?.value;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        user_id?:    string;
        company_id?: string;
        session_id?: string;
      };

      /* Deactivate the session record */
      if (decoded.session_id) {
        await prisma.userSession.updateMany({
          where: { id: decoded.session_id, is_active: true },
          data:  { is_active: false },
        });
      }

      /* Audit */
      if (decoded.user_id && decoded.company_id) {
        const ip = getClientIp(req);
        void logAudit({
          company_id:  decoded.company_id,
          user_id:     decoded.user_id,
          action:      "LOGOUT",
          module:      "AUTH",
          entity_type: "user",
          entity_id:   decoded.user_id,
          description: `User logged out from IP ${ip}`,
        });
      }
    } catch (err) {
      /* Token already expired or invalid — ignore, still clear the cookie.
         Log anything that isn't a simple verification error. */
      if (!(err instanceof Error && err.name === "JsonWebTokenError")) {
        logInternalError(err, { route: "POST /api/auth/logout" });
      }
    }
  }

  /* Build response — clear cookie with explicit past expiry */
  const response = NextResponse.json({ success: true });
  const isSecure =
    req.headers.get("x-forwarded-proto") === "https" ||
    !!process.env.REPLIT_DOMAINS ||
    process.env.NODE_ENV === "production";

  response.cookies.set("token", "", {
    httpOnly: true,
    secure:   isSecure,
    sameSite: isSecure ? "none" : "lax",
    maxAge:   0,
    expires:  new Date(0),   // explicit past date — belt + suspenders
    path:     "/",
  });

  return response;
}

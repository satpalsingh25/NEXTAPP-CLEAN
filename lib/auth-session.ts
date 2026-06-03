/**
 * Shared session creation helper.
 * Used by both local and Azure AD login routes to ensure consistent
 * JWT signing, session recording, and cookie configuration.
 */
import { NextResponse }  from "next/server";
import { NextRequest }   from "next/server";
import jwt               from "jsonwebtoken";
import { prisma }        from "@/lib/prisma";
import { getClientIp }   from "@/lib/rate-limit";

const SESSION_HOURS = 10;
const SESSION_MS    = SESSION_HOURS * 60 * 60 * 1000;

export interface SessionUser {
  id:         string;
  email:      string;
  role:       string;
  company_id: string;
}

/**
 * Creates a UserSession DB record, signs a JWT, and returns a response
 * with the `token` cookie set.  The response body is a JSON object
 * with `{ user }`.
 */
export async function createSessionResponse(
  req:      NextRequest,
  user:     SessionUser,
  redirect?: string,
): Promise<NextResponse> {
  const ip        = getClientIp(req);
  const expiresAt = new Date(Date.now() + SESSION_MS);

  const session = await prisma.userSession.create({
    data: {
      user_id:    user.id,
      company_id: user.company_id,
      ip_address: ip,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      expires_at: expiresAt,
    },
  });

  const token = jwt.sign(
    {
      user_id:    user.id,
      email:      user.email,
      role:       user.role,
      company_id: user.company_id,
      session_id: session.id,
    },
    process.env.JWT_SECRET!,
    { expiresIn: `${SESSION_HOURS}h` },
  );

  const isSecure =
    req.headers.get("x-forwarded-proto") === "https" ||
    !!process.env.REPLIT_DOMAINS ||
    process.env.NODE_ENV === "production";

  const response = redirect
    ? NextResponse.redirect(new URL(redirect, req.url))
    : NextResponse.json({
        user: {
          id:         user.id,
          email:      user.email,
          role:       user.role,
          company_id: user.company_id,
        },
      });

  response.cookies.set("token", token, {
    httpOnly: true,
    secure:   isSecure,
    sameSite: isSecure ? "none" : "lax",
    maxAge:   SESSION_HOURS * 60 * 60,
    path:     "/",
  });

  return response;
}

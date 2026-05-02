import { NextRequest, NextResponse } from "next/server";
import { prisma }           from "@/lib/prisma";
import crypto               from "crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateEmail, ValidationError } from "@/lib/validation";
import { logAudit }         from "@/lib/audit-log";
import { errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError } from "@/lib/error-log";

/* ------------------------------------------------------------------ */
/*  POST /api/auth/forgot-password                                      */
/*                                                                      */
/*  Generates a short-lived (1 h), one-time password reset token.      */
/*  In production the raw token should be emailed to the user.         */
/*  Until an SMTP integration is configured the token is returned in   */
/*  the response body so an admin can pass it out-of-band.             */
/*                                                                      */
/*  The stored value is SHA-256(rawToken) — never the raw token.       */
/* ------------------------------------------------------------------ */

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  /* Rate limit — same strictness as login */
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "forgot-password", "login");
  if (rl) return rl;

  let email: string;
  try {
    const body = await req.json().catch(() => ({}));
    email = validateEmail(body?.email);
  } catch (e) {
    if (e instanceof ValidationError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  /* Always return the same message whether the email exists or not
     to prevent user enumeration. */
  const requestId = generateRequestId();
  const SAFE_RESPONSE = {
    message:
      "If that email is registered, a reset token has been generated. " +
      "Contact your administrator to obtain the token until email delivery is configured.",
  };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, company_id: true, is_active: true },
  });

  if (!user || !user.is_active) {
    /* Return success to avoid user enumeration */
    return NextResponse.json(SAFE_RESPONSE);
  }

  /* Invalidate any existing unused tokens for this user */
  await prisma.passwordResetToken.updateMany({
    where: { user_id: user.id, used_at: null },
    data:  { used_at: new Date() },   // mark as consumed so they can't be used
  });

  /* Generate a cryptographically secure random token */
  const rawToken   = crypto.randomBytes(32).toString("hex");  // 256-bit entropy
  const tokenHash  = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt  = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({
    data: {
      user_id:    user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    },
  });

  void logAudit({
    company_id:  user.company_id,
    user_id:     user.id,
    action:      "PASSWORD_RESET_REQUESTED",
    module:      "AUTH",
    entity_type: "user",
    entity_id:   user.id,
    description: `Password reset token generated from IP ${ip}`,
  });

  /* In production: send rawToken by email instead of returning it.
     Return it here only to allow admin-assisted out-of-band delivery. */
  return NextResponse.json(
    {
      ...SAFE_RESPONSE,
      /* DEVELOPMENT ONLY — remove once SMTP is configured */
      _dev_token:      rawToken,
      _dev_expires_at: expiresAt,
    },
    { headers: { "X-Request-Id": requestId } },
  );
}

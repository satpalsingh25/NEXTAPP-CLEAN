import { NextRequest, NextResponse } from "next/server";
import { prisma }        from "@/lib/prisma";
import bcrypt            from "bcryptjs";
import crypto            from "crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateRequiredString, ValidationError } from "@/lib/validation";
import { logAudit }      from "@/lib/audit-log";
import { errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError } from "@/lib/error-log";

/* ------------------------------------------------------------------ */
/*  POST /api/auth/reset-password                                       */
/*                                                                      */
/*  Body: { token: string; new_password: string }                      */
/*                                                                      */
/*  Validates the one-time reset token (SHA-256 lookup), enforces a    */
/*  minimum password length, updates the password, marks the token     */
/*  used, and deactivates all existing sessions (forcing re-login).    */
/* ------------------------------------------------------------------ */

const MIN_PASSWORD_LEN = 8;

export async function POST(req: NextRequest) {
  /* Rate limit — same strictness as login */
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "reset-password", "login");
  if (rl) return rl;

  let rawToken: string;
  let newPassword: string;
  try {
    const body = await req.json().catch(() => ({}));
    rawToken    = validateRequiredString(body?.token,        256, "token");
    newPassword = validateRequiredString(body?.new_password, 128, "new_password");
  } catch (e) {
    if (e instanceof ValidationError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (newPassword.length < MIN_PASSWORD_LEN) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` },
      { status: 400 },
    );
  }

  /* Lookup token by its hash */
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired reset token." }, { status: 400 });
  }

  if (record.used_at) {
    return NextResponse.json({ error: "This reset token has already been used." }, { status: 400 });
  }

  if (new Date() > record.expires_at) {
    return NextResponse.json({ error: "This reset token has expired." }, { status: 400 });
  }

  /* Fetch user */
  const user = await prisma.user.findUnique({
    where:  { id: record.user_id },
    select: { id: true, company_id: true, is_active: true },
  });

  if (!user || !user.is_active) {
    return NextResponse.json({ error: "Invalid or expired reset token." }, { status: 400 });
  }

  /* Hash new password */
  const passwordHash = await bcrypt.hash(newPassword, 12);  // 12 rounds for reset

  /* Atomic: update password + mark token used + deactivate all sessions */
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash:        passwordHash,
        must_reset_password:  false,
        failed_login_attempts: 0,
        locked_until:         null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data:  { used_at: new Date() },
    }),
    prisma.userSession.updateMany({
      where: { user_id: user.id, is_active: true },
      data:  { is_active: false },
    }),
  ]);

  void logAudit({
    company_id:  user.company_id,
    user_id:     user.id,
    action:      "PASSWORD_RESET_COMPLETED",
    module:      "AUTH",
    entity_type: "user",
    entity_id:   user.id,
    description: `Password reset completed from IP ${ip}`,
  });

  const requestId = generateRequestId();
  return NextResponse.json(
    { success: true, message: "Password updated. Please log in with your new password." },
    { headers: { "X-Request-Id": requestId } },
  );
}

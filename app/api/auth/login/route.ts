import { NextRequest, NextResponse } from "next/server";
import { prisma }         from "@/lib/prisma";
import bcrypt             from "bcryptjs";
import jwt                from "jsonwebtoken";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateEmail, validateRequiredString, ValidationError } from "@/lib/validation";
import { logAudit }       from "@/lib/audit-log";
import { errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError } from "@/lib/error-log";

/* ------------------------------------------------------------------ */
/*  Session constants                                                    */
/* ------------------------------------------------------------------ */
const SESSION_HOURS   = 10;                              // Step 1: 8–12 h window
const SESSION_MS      = SESSION_HOURS * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES     = 15;

/* ------------------------------------------------------------------ */
/*  POST /api/auth/login                                                */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  /* ── Step 5: Rate limit — IP-keyed, blocks credential stuffing ── */
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "login", "login");
  if (rl) return rl;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  /* ── Step 10: Validate inputs — no type hints in error messages ── */
  let email: string;
  let password: string;
  try {
    email    = validateEmail((body as Record<string, unknown>)?.email);
    password = validateRequiredString((body as Record<string, unknown>)?.password, 128, "Password");
  } catch (e) {
    if (e instanceof ValidationError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  try {
    /* ── Lookup user ─────────────────────────────────────────────── */
    const user = await prisma.user.findUnique({
      where:   { email },
      include: { company: true },
    });

    /* ── Step 10: Never reveal whether the account exists ─────── */
    if (!user || !user.is_active) {
      void logAudit({
        company_id:  "system",
        user_id:     undefined,
        action:      "LOGIN_FAILED",
        module:      "AUTH",
        entity_type: "user",
        description: `Failed login attempt for email ${email} from IP ${ip} — account not found or inactive`,
      });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    /* ── Step 5: Check lockout ───────────────────────────────────── */
    if (user.locked_until && user.locked_until > new Date()) {
      const minutesLeft = Math.ceil(
        (user.locked_until.getTime() - Date.now()) / 60_000,
      );
      void logAudit({
        company_id:  user.company_id,
        user_id:     user.id,
        action:      "LOGIN_BLOCKED",
        module:      "AUTH",
        entity_type: "user",
        entity_id:   user.id,
        description: `Login blocked — account locked until ${user.locked_until.toISOString()} (IP: ${ip})`,
      });
      return NextResponse.json(
        { error: `Account temporarily locked. Try again in ${minutesLeft} minute(s).` },
        { status: 423 },
      );
    }

    /* ── Step 10: Verify password ────────────────────────────────── */
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      /* ── Step 5: Increment failure counter, apply lockout ──────── */
      const newCount = user.failed_login_attempts + 1;
      const lockout  = newCount >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
        : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failed_login_attempts: newCount,
          ...(lockout ? { locked_until: lockout } : {}),
        },
      });

      /* ── Step 4: Audit — failed login ────────────────────────── */
      void logAudit({
        company_id:  user.company_id,
        user_id:     user.id,
        action:      "LOGIN_FAILED",
        module:      "AUTH",
        entity_type: "user",
        entity_id:   user.id,
        description: `Failed login attempt ${newCount}/${MAX_FAILED_ATTEMPTS} from IP ${ip}${lockout ? " — account locked" : ""}`,
      });

      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    /* ── Login success: reset failure counter ────────────────────── */
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failed_login_attempts: 0,
        locked_until:          null,
      },
    });

    /* ── Step 8: Create session record ───────────────────────────── */
    const expiresAt = new Date(Date.now() + SESSION_MS);
    const session   = await prisma.userSession.create({
      data: {
        user_id:    user.id,
        company_id: user.company_id,
        ip_address: ip,
        user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
        expires_at: expiresAt,
      },
    });

    /* ── Step 1: Issue JWT — 10 h expiry ─────────────────────────── */
    /* Step 9: Payload always carries user_id, company_id, role      */
    const token = jwt.sign(
      {
        user_id:    user.id,
        email:      user.email,
        role:       user.role,
        company_id: user.company_id,
        session_id: session.id,    // Step 8: enables session lookup / force-logout
      },
      process.env.JWT_SECRET!,
      { expiresIn: `${SESSION_HOURS}h` },
    );

    /* ── Step 4: Audit — successful login ────────────────────────── */
    void logAudit({
      company_id:  user.company_id,
      user_id:     user.id,
      action:      "LOGIN_SUCCESS",
      module:      "AUTH",
      entity_type: "user",
      entity_id:   user.id,
      description: `Successful login from IP ${ip}`,
    });

    /* ── Step 3: Build response + set secure cookie ──────────────── */
    const response = NextResponse.json({
      user: {
        id:         user.id,
        email:      user.email,
        role:       user.role,
        company_id: user.company_id,
      },
    });

    const isSecure =
      req.headers.get("x-forwarded-proto") === "https" ||
      !!process.env.REPLIT_DOMAINS ||
      process.env.NODE_ENV === "production";

    /* Step 3: HttpOnly + Secure + SameSite + explicit expiry */
    response.cookies.set("token", token, {
      httpOnly: true,
      secure:   isSecure,
      sameSite: isSecure ? "none" : "lax",
      maxAge:   SESSION_HOURS * 60 * 60,   // seconds (10 h)
      path:     "/",
    });

    return response;
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: "POST /api/auth/login", request_id: requestId });
    return errorResponse("Something went wrong. Please try again.", 500, requestId);
  }
}

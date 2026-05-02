import { NextRequest, NextResponse } from "next/server";
import { prisma }         from "@/lib/prisma";
import bcrypt             from "bcryptjs";
import jwt                from "jsonwebtoken";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateEmail, validateRequiredString, ValidationError } from "@/lib/validation";

export async function POST(req: NextRequest) {
  /* 1. Rate limit — keyed by IP to block credential-stuffing attacks */
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "login", "login");
  if (rl) return rl;

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    /* 2. Validate inputs */
    let email: string;
    let password: string;
    try {
      email    = validateEmail((body as Record<string, unknown>)?.email);
      password = validateRequiredString((body as Record<string, unknown>)?.password, 128, "Password");
    } catch (e) {
      if (e instanceof ValidationError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    /* 3. Lookup user */
    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!user || !user.is_active) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    /* 4. Verify password */
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    /* 5. Issue JWT */
    const token = jwt.sign(
      {
        user_id:    user.id,
        email:      user.email,
        role:       user.role,
        company_id: user.company_id,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" },
    );

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

    response.cookies.set("token", token, {
      httpOnly: true,
      secure:   isSecure,
      sameSite: isSecure ? "none" : "lax",
      maxAge:   60 * 60 * 24,
      path:     "/",
    });

    return response;
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

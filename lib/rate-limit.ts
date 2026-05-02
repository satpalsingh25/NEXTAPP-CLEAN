import { NextResponse } from "next/server";

/* ================================================================== */
/*  Lightweight In-Memory Rate Limiter                                  */
/*                                                                      */
/*  Uses a sliding window per (identifier × route) key.               */
/*  In-memory Map — acceptable for single-process Next.js.             */
/*  Future: swap store for Redis for multi-process deployments.        */
/* ================================================================== */

interface Window {
  count:   number;
  resetAt: number;
}

/* Global store — persists for the lifetime of the Node.js process. */
const store = new Map<string, Window>();

/* ------------------------------------------------------------------ */
/* Presets                                                               */
/* ------------------------------------------------------------------ */
const PRESETS = {
  /** Public auth endpoints — strictest limit to slow credential stuffing. */
  login:   { max: 10,  windowMs: 15 * 60 * 1000 },
  /** File upload — moderate cost per request. */
  upload:  { max: 20,  windowMs: 15 * 60 * 1000 },
  /** Write operations (create / update). */
  write:   { max: 30,  windowMs: 15 * 60 * 1000 },
  /** Submission actions. */
  submit:  { max: 20,  windowMs: 15 * 60 * 1000 },
  /** File download / preview. */
  files:   { max: 100, windowMs: 15 * 60 * 1000 },
  /** Generic read-heavy endpoints. */
  default: { max: 100, windowMs: 15 * 60 * 1000 },
} as const;

export type RateLimitPreset = keyof typeof PRESETS;

/* ------------------------------------------------------------------ */
/* checkRateLimit                                                        */
/*                                                                      */
/* @param identifier  Unique caller key (user_id for auth'd routes,    */
/*                    IP address for public routes like /login).        */
/* @param route       Short route label, e.g. "login" or "dms-upload". */
/* @param preset      Which limit bucket to use (default: "default").  */
/*                                                                      */
/* Returns null when the request is allowed.                            */
/* Returns a 429 NextResponse when the limit is exceeded.              */
/* ------------------------------------------------------------------ */
export function checkRateLimit(
  identifier: string,
  route: string,
  preset: RateLimitPreset = "default",
): NextResponse | null {
  const { max, windowMs } = PRESETS[preset];
  const key = `${identifier}:${route}`;
  const now = Date.now();

  const win = store.get(key);

  if (!win || now >= win.resetAt) {
    /* First request in this window — open a new window. */
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (win.count >= max) {
    const retryAfter = Math.ceil((win.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After":         String(retryAfter),
          "X-RateLimit-Limit":   String(max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset":   String(Math.ceil(win.resetAt / 1000)),
        },
      },
    );
  }

  /* Within window and below limit — increment counter. */
  win.count++;
  return null;
}

/* ------------------------------------------------------------------ */
/* getClientIp                                                           */
/*                                                                      */
/* Extracts the real client IP from Next.js request headers.           */
/* Used as the identifier for unauthenticated endpoints (e.g. /login). */
/* ------------------------------------------------------------------ */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PAGES = ["/dashboard", "/compliance", "/amc", "/admin", "/approvals"];
const AUTH_PAGES      = ["/auth/login", "/auth/register"];

const ADMIN_ONLY    = new Set(["ADMIN", "SUPER_ADMIN"]);
const MANAGER_PLUS  = new Set(["ADMIN", "SUPER_ADMIN", "MANAGER"]);
const APPROVER_ONLY = new Set(["ADMIN", "SUPER_ADMIN", "APPROVER"]);
const ALL_ROLES     = new Set(["ADMIN", "SUPER_ADMIN", "MANAGER", "APPROVER", "USER", "CEO"]);

function getRoleFromToken(req: NextRequest): string | null {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  try {
    const [, b64] = token.split(".");
    const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(padded));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

function matchesAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function deny(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/unauthorized";
  url.search = "";
  return NextResponse.redirect(url);
}

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasToken = !!req.cookies.get("token")?.value;

  // 1. Unauthenticated → login
  if (matchesAny(pathname, PROTECTED_PAGES) && !hasToken) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // 2. Already logged in → skip auth pages
  if (matchesAny(pathname, AUTH_PAGES) && hasToken) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // 3. Role-based guards
  if (hasToken) {
    const role = getRoleFromToken(req);

    if (!role || !ALL_ROLES.has(role)) return deny(req);

    // ADMIN only — admin panel
    if (matchesAny(pathname, ["/admin"])) {
      if (!ADMIN_ONLY.has(role)) return deny(req);
    }

    // ADMIN only — template management
    if (matchesAny(pathname, ["/compliance/templates", "/amc/templates"])) {
      if (!ADMIN_ONLY.has(role)) return deny(req);
    }

    // ADMIN only — company-level approval matrix
    if (matchesAny(pathname, ["/compliance/approval-matrix", "/amc/approval-matrix"])) {
      if (!ADMIN_ONLY.has(role)) return deny(req);
    }

    // ADMIN only — per-record approval matrix: /compliance/<id>/approval-matrix
    if (/^\/compliance\/[^/]+\/approval-matrix(\/|$)/.test(pathname)) {
      if (!ADMIN_ONLY.has(role)) return deny(req);
    }
    if (/^\/amc\/[^/]+\/approval-matrix(\/|$)/.test(pathname)) {
      if (!ADMIN_ONLY.has(role)) return deny(req);
    }

    // MANAGER+ only — create records
    if (matchesAny(pathname, ["/compliance/create", "/amc/create"])) {
      if (!MANAGER_PLUS.has(role)) return deny(req);
    }

    // APPROVER / ADMIN only — pending approval queues (MANAGER excluded)
    if (matchesAny(pathname, ["/compliance/pending-approval", "/amc/pending-approval", "/amc/approvals", "/approvals"])) {
      if (!APPROVER_ONLY.has(role)) return deny(req);
    }

    // CEO & USER: read-only — access to /compliance, /amc, /dashboard is allowed above.
    // Write actions are enforced at the API layer (MANAGER_PLUS / SUBMIT_ROLES).
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path+",
    "/compliance",
    "/compliance/:path+",
    "/amc",
    "/amc/:path+",
    "/admin",
    "/admin/:path+",
    "/approvals",
    "/approvals/:path+",
    "/auth/login",
    "/auth/register",
    "/auth/:path+",
  ],
};

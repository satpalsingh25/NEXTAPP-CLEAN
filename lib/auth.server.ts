import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export interface AuthUser {
  user_id: string;
  company_id: string;
  role: string;
  email: string;
}

export const ADMIN_ONLY    = ["ADMIN", "SUPER_ADMIN"];
export const MANAGER_PLUS  = ["ADMIN", "SUPER_ADMIN", "MANAGER"];
export const APPROVER_PLUS = ["ADMIN", "SUPER_ADMIN", "MANAGER", "APPROVER", "CHECKER"];
// Everyone except CEO (read-only) — for actions like submit
export const SUBMIT_ROLES  = ["ADMIN", "SUPER_ADMIN", "MANAGER", "APPROVER", "USER"];

export function getAuthUser(req: NextRequest): AuthUser | null {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export function requireAuth(req: NextRequest): { user: AuthUser } | { error: NextResponse } {
  const user = getAuthUser(req);
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user };
}

export function requireRole(req: NextRequest, roles: string[]): { user: AuthUser } | { error: NextResponse } {
  const auth = requireAuth(req);
  if ("error" in auth) return auth;
  if (!roles.includes(auth.user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}

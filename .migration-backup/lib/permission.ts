/**
 * Backend permission helpers — lightweight security layer.
 *
 * All three helpers are throw-on-failure so they can be composed inside a
 * try/catch that maps to a uniform 403 response (see usage example below).
 *
 * Usage pattern:
 *
 *   import { checkAuth, checkRole, checkCompanyAccess } from "@/lib/permission"
 *
 *   export async function GET(req: NextRequest) {
 *     const auth = requireAuth(req)          // from lib/auth.server
 *     if ("error" in auth) return auth.error
 *     try {
 *       checkRole(auth.user, ["ADMIN", "SUPER_ADMIN"])
 *       const record = await prisma.thing.findFirst({ where: { id, company_id: auth.user.company_id } })
 *       checkCompanyAccess(auth.user, record?.company_id)
 *       ...
 *     } catch (err) {
 *       console.warn("[security] access denied:", auth.user?.user_id, (err as Error).message)
 *       return NextResponse.json({ error: "Access denied" }, { status: 403 })
 *     }
 *   }
 */

export interface PermUser {
  user_id:    string;
  company_id: string;
  role:       string;
  email?:     string;
}

/**
 * Throws if the user does not have one of the given roles.
 */
export function checkRole(user: PermUser, roles: string[]): void {
  if (!roles.includes(user.role)) {
    console.warn("[security] role denied:", user.user_id, "has", user.role, "needs one of", roles);
    throw new Error("Forbidden: insufficient role");
  }
}

/**
 * Throws if the user's company_id does not match the resource's company_id.
 * Pass `null` or `undefined` to trigger denial (resource not found → deny).
 */
export function checkCompanyAccess(user: PermUser, resourceCompanyId: string | null | undefined): void {
  if (!resourceCompanyId || user.company_id !== resourceCompanyId) {
    if (user.role !== "SUPER_ADMIN") {
      console.warn("[security] cross-tenant attempt:", user.user_id, "company", user.company_id, "→ resource company", resourceCompanyId);
      throw new Error("Access denied: cross-tenant");
    }
  }
}

/**
 * Convenience: throws if the resource is null/undefined (not found → deny).
 * Use before checkCompanyAccess to avoid leaking whether a record exists.
 */
export function checkExists<T>(resource: T | null | undefined, label = "resource"): asserts resource is T {
  if (resource == null) {
    throw new Error(`${label} not found`);
  }
}

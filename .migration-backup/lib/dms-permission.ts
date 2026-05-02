import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/lib/auth.server";

export interface FolderAccess {
  can_read:   boolean;
  can_upload: boolean;
  can_write:  boolean;
  can_delete: boolean;
}

const DENY_ALL: FolderAccess = {
  can_read:   false,
  can_upload: false,
  can_write:  false,
  can_delete: false,
};

const FULL_ACCESS: FolderAccess = {
  can_read:   true,
  can_upload: true,
  can_write:  true,
  can_delete: true,
};

/**
 * Resolves the effective permissions a user has on a folder.
 *
 * Rules:
 *  - USER-type folder: if created_by === user.user_id → FULL ACCESS.
 *    Never touches the FolderPermission table for USER folders.
 *  - TEAM-type folder: merges all matching FolderPermission records (OR logic).
 *    If no records exist for the folder itself, walks up the hierarchy to the
 *    nearest ancestor that has permission records (subfolders inherit from their
 *    root team folder).
 *
 * @param user      - AuthUser from the JWT (user_id + company_id always present)
 * @param folder_id - The UUID of the folder to check
 */
export async function checkFolderAccess(
  user: AuthUser,
  folder_id: string,
): Promise<FolderAccess> {
  /* ── 1. Fetch the folder ────────────────────────────────────────── */
  const folder = await prisma.dmsFolder.findUnique({
    where:  { id: folder_id },
    select: { type: true, created_by: true, company_id: true, parent_id: true },
  });

  if (!folder) return { ...DENY_ALL };

  /* Cross-tenant guard */
  if (folder.company_id !== user.company_id) return { ...DENY_ALL };

  /* ── 2. USER-type folder: owner gets full access, no perm table ── */
  if (folder.type === "USER") {
    if (folder.created_by === user.user_id) return { ...FULL_ACCESS };
    return { ...DENY_ALL };
  }

  /* ── 3. Admin shortcut: full access without touching the DB ─────── */
  if (user.role === "ADMIN") return { ...FULL_ACCESS };

  /* ── 4. TEAM-type folder: resolve via FolderPermission table ───── */
  const fullUser = await prisma.user.findUnique({
    where:  { id: user.user_id },
    select: {
      id:            true,
      company_id:    true,
      group_id:      true,
      department_id: true,
      function_id:   true,
    },
  });

  if (!fullUser) return { ...DENY_ALL };

  /* Walk up the hierarchy until we find an ancestor with permission records.
     Subfolders inherit permissions from their root team folder.               */
  let checkId: string = folder_id;
  let records: Awaited<ReturnType<typeof prisma.folderPermission.findMany>> = [];

  for (let depth = 0; depth < 20; depth++) {
    records = await prisma.folderPermission.findMany({
      where: { folder_id: checkId },
    });

    if (records.length > 0) break;

    /* No records — move up to parent */
    const current = await prisma.dmsFolder.findUnique({
      where:  { id: checkId },
      select: { parent_id: true },
    });
    if (!current?.parent_id) break;
    checkId = current.parent_id;
  }

  if (records.length === 0) return { ...DENY_ALL };

  const result: FolderAccess = { ...DENY_ALL };

  for (const rec of records) {
    const matched =
      (rec.access_type === "USER"       && rec.access_id === fullUser.id) ||
      (rec.access_type === "GROUP"      && fullUser.group_id      !== null && rec.access_id === fullUser.group_id) ||
      (rec.access_type === "DEPARTMENT" && fullUser.department_id !== null && rec.access_id === fullUser.department_id) ||
      (rec.access_type === "FUNCTION"   && fullUser.function_id   !== null && rec.access_id === fullUser.function_id) ||
      (rec.access_type === "COMPANY"    && rec.access_id === fullUser.company_id);

    if (matched) {
      if (rec.can_read)   result.can_read   = true;
      if (rec.can_upload) result.can_upload = true;
      if (rec.can_write)  result.can_write  = true;
      if (rec.can_delete) result.can_delete = true;
    }

    if (result.can_read && result.can_upload && result.can_write && result.can_delete) break;
  }

  return result;
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import { gateModule } from "@/lib/module-access";

/* ------------------------------------------------------------------ */
/* GET /api/dms/team-folders                                           */
/*                                                                      */
/* Returns every TEAM folder the current user can read, based on       */
/* FolderPermission records (USER / GROUP / DEPARTMENT / FUNCTION /    */
/* COMPANY principal types).                                           */
/*                                                                      */
/* Uses 3 DB queries total — no per-folder N+1:                        */
/*   1. Full user profile  (group / dept / function)                   */
/*   2. All TEAM folders   for the company                             */
/*   3. All permissions    for those folder IDs (single IN query)      */
/*                                                                      */
/* In-memory: match permissions → OR-merge → keep folders with        */
/* can_read = true on at least one matching record.                    */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "DMS");
  if (gate) return gate;
  const { user_id, company_id } = auth.user;

  /* 1. Fetch full user profile --------------------------------------- */
  /*    JWT only carries user_id + company_id; group / dept / function */
  /*    are stored in the DB and needed for permission matching.        */
  const fullUser = await prisma.user.findUnique({
    where:  { id: user_id },
    select: {
      id:            true,
      company_id:    true,
      group_id:      true,
      department_id: true,
      function_id:   true,
    },
  });

  if (!fullUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  /* 2. Fetch all TEAM folders for this company ----------------------- */
  const teamFolders = await prisma.dmsFolder.findMany({
    where: { company_id, type: "TEAM" },
    orderBy: { name: "asc" },
  });

  if (teamFolders.length === 0) {
    return NextResponse.json([]);
  }

  /* 3. Batch-fetch all FolderPermission rows for those folders ------- */
  const folderIds = teamFolders.map((f) => f.id);

  const permissions = await prisma.folderPermission.findMany({
    where: { folder_id: { in: folderIds } },
  });

  /* 4. Group permissions by folder_id for O(1) look-up --------------- */
  const permsByFolder = new Map<string, typeof permissions>();
  for (const perm of permissions) {
    const existing = permsByFolder.get(perm.folder_id) ?? [];
    existing.push(perm);
    permsByFolder.set(perm.folder_id, existing);
  }

  /* 5. In-memory filter --------------------------------------------- */
  /*    A folder is accessible when at least one matching permission   */
  /*    record has can_read = true.                                    */
  /*    Principal match rules (same as checkFolderAccess):            */
  /*      USER       → perm.access_id === user.id                     */
  /*      GROUP      → perm.access_id === user.group_id               */
  /*      DEPARTMENT → perm.access_id === user.department_id          */
  /*      FUNCTION   → perm.access_id === user.function_id            */
  /*      COMPANY    → perm.access_id === user.company_id             */
  const accessible = teamFolders.filter((folder) => {
    const folderPerms = permsByFolder.get(folder.id) ?? [];

    return folderPerms.some((perm) => {
      if (!perm.can_read) return false;           // permission doesn't grant read

      switch (perm.access_type) {
        case "USER":
          return perm.access_id === fullUser.id;
        case "GROUP":
          return fullUser.group_id !== null && perm.access_id === fullUser.group_id;
        case "DEPARTMENT":
          return fullUser.department_id !== null && perm.access_id === fullUser.department_id;
        case "FUNCTION":
          return fullUser.function_id !== null && perm.access_id === fullUser.function_id;
        case "COMPANY":
          return perm.access_id === fullUser.company_id;
        default:
          return false;
      }
    });
  });

  /* 6. Return accessible folders ------------------------------------ */
  return NextResponse.json(accessible);
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import { checkFolderAccess } from "@/lib/dms-permission";
import { getDriveId, getSharePointToken } from "@/lib/sharepoint-check";
import { gateModule } from "@/lib/module-access";

/* ------------------------------------------------------------------ */
/* DELETE /api/dms/folder?folder_id=<uuid>                             */
/*                                                                      */
/* Recursively deletes a folder tree:                                  */
/*  1. Auth + cross-tenant guard                                       */
/*  2. Permission check (can_delete required)                          */
/*  3. Collect all descendant folders                                  */
/*  4. SharePoint delete by path (best-effort, logs on failure)        */
/*  5. DB transaction — documents → child folders → parent folder      */
/* ------------------------------------------------------------------ */
export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "DMS");
  if (gate) return gate;
  const { company_id } = auth.user;

  const { searchParams } = new URL(req.url);
  const folder_id = searchParams.get("folder_id");

  if (!folder_id) {
    return NextResponse.json({ error: "folder_id is required." }, { status: 400 });
  }

  /* 1. Fetch folder + cross-tenant guard ----------------------------- */
  const folder = await prisma.dmsFolder.findUnique({ where: { id: folder_id } });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }
  if (folder.company_id !== company_id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  /* 2. Permission check --------------------------------------------- */
  /* USER folders: owner always has full access — skip perm table     */
  const isOwnerUserFolder =
    folder.type === "USER" && folder.created_by === auth.user.user_id;

  if (!isOwnerUserFolder) {
    const access = await checkFolderAccess(auth.user, folder_id);
    if (!access.can_delete) {
      return NextResponse.json(
        { error: "You do not have permission to delete this folder." },
        { status: 403 },
      );
    }
  }

  /* 3. Collect all descendant folder IDs ----------------------------- */
  /*    Use path prefix: any folder whose path starts with             */
  /*    "{folder.path}/" is a direct or nested child.                  */
  const childFolders = await prisma.dmsFolder.findMany({
    where: {
      company_id,
      path: { startsWith: folder.path + "/" },
    },
    select: { id: true, path: true },
  });

  const allFolderIds  = [folder_id, ...childFolders.map((f) => f.id)];
  const allFolderPaths = [folder.path, ...childFolders.map((f) => f.path)];

  /* 4. Best-effort SharePoint delete --------------------------------- */
  /*    Deleting the parent path removes the entire subtree in SP.     */
  try {
    const [drive_id, accessToken] = await Promise.all([
      getDriveId(company_id),
      getSharePointToken(company_id),
    ]);

    const folderPath  = folder.path.replace(/^\/+|\/+$/g, "");
    const spDeleteUrl =
      `https://graph.microsoft.com/v1.0/drives/${drive_id}/root:/${folderPath}`;

    const spRes = await fetch(spDeleteUrl, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (spRes.status === 404) {
      // Folder no longer exists in SharePoint — orphan record in DB
      console.log(`[DMS] Orphan cleaned: folder "${folder.path}" not found in SharePoint, proceeding with DB cleanup.`);
    } else if (!spRes.ok && spRes.status !== 204) {
      // 204 = deleted successfully (no body)
      const errJson = await spRes.json().catch(() => ({})) as { error?: { message?: string } };
      console.error(
        `[DMS] SharePoint folder delete failed for path "${folder.path}":`,
        errJson?.error?.message ?? spRes.statusText,
      );
      // Non-blocking — continue with DB cleanup
    }
  } catch (err) {
    console.error("[DMS] SharePoint folder delete error (non-blocking):", err);
  }

  /* 5. DB transaction ----------------------------------------------- */
  /*    Order: documents first → child folders → parent folder         */
  await prisma.$transaction([
    /* 5a. Delete all DmsDocuments in this folder tree */
    prisma.dmsDocument.deleteMany({
      where: {
        company_id,
        OR: allFolderPaths.map((p) => ({ folder_path: p })),
      },
    }),

    /* 5b. Delete all descendant DmsFolder records */
    prisma.dmsFolder.deleteMany({
      where: { id: { in: childFolders.map((f) => f.id) } },
    }),

    /* 5c. Delete the parent folder record */
    prisma.dmsFolder.delete({ where: { id: folder_id } }),
  ]);

  return NextResponse.json({ success: true });
}

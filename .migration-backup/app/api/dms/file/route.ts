import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import { getDriveId, getSharePointToken } from "@/lib/sharepoint-check";
import { checkFolderAccess } from "@/lib/dms-permission";
import { gateModule } from "@/lib/module-access";
import { logAudit } from "@/lib/audit-log";

/* ------------------------------------------------------------------ */
/* GET /api/dms/file?file_id=<uuid>[&download=true]                    */
/*                                                                      */
/* Proxies a file from SharePoint through the server so the client     */
/* never needs a raw SharePoint URL or a Graph token.                  */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "DMS");
  if (gate) return gate;
  const { company_id } = auth.user;

  const { searchParams } = new URL(req.url);
  const file_id  = searchParams.get("file_id");
  const download = searchParams.get("download") === "true";

  if (!file_id) {
    return NextResponse.json({ error: "file_id is required." }, { status: 400 });
  }

  /* 1. Fetch document record & cross-tenant guard ------------------- */
  const doc = await prisma.dmsDocument.findUnique({ where: { id: file_id } });
  if (!doc) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  if (doc.company_id !== company_id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  /* 2. Resolve drive_id + access token in parallel ----------------- */
  let drive_id:    string;
  let accessToken: string;
  try {
    [drive_id, accessToken] = await Promise.all([
      getDriveId(company_id),
      getSharePointToken(company_id),
    ]);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: `SharePoint configuration error: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  /* 3. Fetch file content from Graph API via path-based URL --------- */
  /*    /drives/{drive_id}/root:/{folder_path}/{filename}:/content     */
  const folderPath = doc.folder_path.replace(/^\/+|\/+$/g, "");
  const filename   = doc.name;
  const graphUrl   =
    `https://graph.microsoft.com/v1.0/drives/${drive_id}/root:/${folderPath}/${encodeURIComponent(filename)}:/content`;

  let spRes: Response;
  try {
    spRes = await fetch(graphUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      redirect: "follow",           // Graph may redirect to a CDN URL for the content
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: `Failed to reach SharePoint: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  if (!spRes.ok) {
    const errJson = await spRes.json().catch(() => ({})) as { error?: { message?: string } };
    return NextResponse.json(
      {
        error: `SharePoint returned ${spRes.status}: ${
          errJson?.error?.message ?? spRes.statusText
        }`,
      },
      { status: 502 },
    );
  }

  /* 4. Build response headers --------------------------------------- */
  const contentType =
    spRes.headers.get("Content-Type") ?? "application/octet-stream";

  const disposition = download
    ? `attachment; filename="${filename}"`
    : `inline; filename="${filename}"`;

  /* 5. Stream the file body back to the client --------------------- */
  if (download) {
    void logAudit({ company_id, user_id: auth.user.user_id, action: "DOWNLOAD_FILE", module: "DMS", entity_type: "file", entity_id: doc.id, description: `Downloaded ${doc.name}` });
  }
  return new NextResponse(spRes.body, {
    status: 200,
    headers: {
      "Content-Type":        contentType,
      "Content-Disposition": disposition,
      // Forward length if Graph provided it (helps progress indicators)
      ...(spRes.headers.get("Content-Length")
        ? { "Content-Length": spRes.headers.get("Content-Length")! }
        : {}),
      // Prevent intermediary caching of authenticated file content
      "Cache-Control": "private, no-store",
    },
  });
}

/* ------------------------------------------------------------------ */
/* DELETE /api/dms/file?file_id=<uuid>                                 */
/*                                                                      */
/* 1. Fetch DmsDocument + cross-tenant guard                           */
/* 2. Resolve parent folder → checkFolderAccess() → reject if no perm */
/* 3. Delete from SharePoint (best-effort — logged, never blocks)      */
/* 4. Delete DmsDocument record                                        */
/* 5. Return { success: true }                                         */
/* ------------------------------------------------------------------ */
export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "DMS");
  if (gate) return gate;
  const { company_id } = auth.user;

  const { searchParams } = new URL(req.url);
  const file_id = searchParams.get("file_id");

  if (!file_id) {
    return NextResponse.json({ error: "file_id is required." }, { status: 400 });
  }

  /* 1. Fetch document + cross-tenant guard -------------------------- */
  const doc = await prisma.dmsDocument.findUnique({ where: { id: file_id } });
  if (!doc) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  if (doc.company_id !== company_id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  /* 2. Check folder permission -------------------------------------- */
  const parentFolder = await prisma.dmsFolder.findFirst({
    where:  { company_id, path: doc.folder_path },
    select: { id: true, type: true, created_by: true },
  });

  if (!parentFolder) {
    return NextResponse.json(
      { error: "You do not have permission to delete this file." },
      { status: 403 },
    );
  }

  /* USER folders: owner always has full access — skip perm table */
  const isOwnerUserFolder =
    parentFolder.type === "USER" && parentFolder.created_by === auth.user.user_id;

  if (!isOwnerUserFolder) {
    const access = await checkFolderAccess(auth.user, parentFolder.id);
    if (!access.can_delete) {
      return NextResponse.json(
        { error: "You do not have permission to delete files in this folder." },
        { status: 403 },
      );
    }
  }

  /* 3. Best-effort delete from SharePoint --------------------------- */
  if (doc.drive_id && doc.sharepoint_item_id) {
    try {
      const accessToken = await getSharePointToken(company_id);
      const spRes = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${doc.drive_id}/items/${doc.sharepoint_item_id}`,
        {
          method:  "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (spRes.status === 404) {
        // Item no longer exists in SharePoint — orphan record in DB
        console.log(`[DMS] Orphan cleaned: item ${doc.sharepoint_item_id} not found in SharePoint, proceeding with DB delete.`);
      } else if (!spRes.ok) {
        const errJson = await spRes.json().catch(() => ({})) as { error?: { message?: string } };
        console.error(
          `[DMS] SharePoint delete failed for item ${doc.sharepoint_item_id}:`,
          errJson?.error?.message ?? spRes.statusText,
        );
        // Non-blocking — continue to DB delete
      }
    } catch (err) {
      console.error("[DMS] SharePoint delete error (non-blocking):", err);
    }
  }

  /* 4. Delete DB record --------------------------------------------- */
  await prisma.dmsDocument.delete({ where: { id: file_id } });

  void logAudit({ company_id, user_id: auth.user.user_id, action: "DELETE_FILE", module: "DMS", entity_type: "file", entity_id: file_id, description: `Deleted file ${doc.name}` });

  /* 5. Return success ----------------------------------------------- */
  return NextResponse.json({ success: true });
}

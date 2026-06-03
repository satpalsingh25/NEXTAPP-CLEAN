import { NextRequest, NextResponse } from "next/server";
import { prisma }                   from "@/lib/prisma";
import { requireAuth }              from "@/lib/auth.server";
import { getDriveId, getSharePointToken } from "@/lib/sharepoint-check";
import { checkFolderAccess }        from "@/lib/dms-permission";
import { gateModule } from "@/lib/module-access";
import { downloadFileFromProvider } from "@/lib/storage/storage-service";

/* ------------------------------------------------------------------ */
/* MIME type map — used as fallback when SharePoint omits Content-Type  */
/* ------------------------------------------------------------------ */
const MIME_BY_EXT: Record<string, string> = {
  pdf:  "application/pdf",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  gif:  "image/gif",
  webp: "image/webp",
  svg:  "image/svg+xml",
  txt:  "text/plain",
  csv:  "text/csv",
  mp4:  "video/mp4",
  mp3:  "audio/mpeg",
};

function mimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/* ------------------------------------------------------------------ */
/* GET /api/dms/file-preview?id={fileId}                               */
/*                                                                      */
/* Streams the file inline (never as a download attachment) so the     */
/* browser can render it inside an <iframe> or <img>.                  */
/* Auth-guarded with cross-tenant + folder permission checks.          */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "DMS");
  if (gate) return gate;
  const { company_id } = auth.user;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  /* 1. Fetch document + cross-tenant guard -------------------------- */
  const doc = await prisma.dmsDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  if (doc.company_id !== company_id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  /* 2. Permission check --------------------------------------------- */
  const parentFolder = await prisma.dmsFolder.findFirst({
    where:  { company_id, path: doc.folder_path },
    select: { id: true, type: true, created_by: true },
  });

  if (parentFolder) {
    const isOwnerUserFolder =
      parentFolder.type === "USER" && parentFolder.created_by === auth.user.user_id;

    if (!isOwnerUserFolder) {
      const access = await checkFolderAccess(auth.user, parentFolder.id);
      if (!access.can_read) {
        return NextResponse.json(
          { error: "You do not have permission to view this file." },
          { status: 403 },
        );
      }
    }
  }

  /* 3a. Fast path: non-SharePoint provider (e.g. Google Drive) ------ */
  if (doc.storage_provider_id) {
    const provResult = await downloadFileFromProvider(
      company_id,
      { storage_provider_id: doc.storage_provider_id, sharepoint_item_id: doc.sharepoint_item_id },
      `${doc.folder_path}/${doc.name}`,
    ).catch(() => null);

    if (provResult) {
      return new NextResponse(provResult.buffer, {
        status: 200,
        headers: {
          "Content-Type":        provResult.mimeType,
          "Content-Disposition": `inline; filename="${doc.name}"`,
          "Cache-Control":       "private, no-store",
        },
      });
    }
  }

  /* 3b. Resolve SharePoint credentials ------------------------------ */
  let drive_id: string;
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

  /* 4. Fetch file content from Graph API ---------------------------- */
  const folderPath = doc.folder_path.replace(/^\/+|\/+$/g, "");
  const graphUrl   =
    `https://graph.microsoft.com/v1.0/drives/${drive_id}/root:/${folderPath}/${encodeURIComponent(doc.name)}:/content`;

  let spRes: Response;
  try {
    spRes = await fetch(graphUrl, {
      headers:  { Authorization: `Bearer ${accessToken}` },
      redirect: "follow",
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
      { error: `SharePoint returned ${spRes.status}: ${errJson?.error?.message ?? spRes.statusText}` },
      { status: 502 },
    );
  }

  /* 5. Determine Content-Type (SharePoint first, then extension-based) */
  const contentType =
    spRes.headers.get("Content-Type")?.split(";")[0].trim() || mimeFromName(doc.name);

  /* 6. Stream inline — never attachment ----------------------------- */
  return new NextResponse(spRes.body, {
    status: 200,
    headers: {
      "Content-Type":        contentType,
      "Content-Disposition": `inline; filename="${doc.name}"`,
      "Cache-Control":       "private, no-store",
      ...(spRes.headers.get("Content-Length")
        ? { "Content-Length": spRes.headers.get("Content-Length")! }
        : {}),
    },
  });
}

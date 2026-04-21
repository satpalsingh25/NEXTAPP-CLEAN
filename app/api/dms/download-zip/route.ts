import { NextRequest, NextResponse } from "next/server";
import { Readable }                 from "stream";
import { PassThrough }              from "stream";
import archiver                     from "archiver";
import { prisma }                   from "@/lib/prisma";
import { requireAuth }              from "@/lib/auth.server";
import { getDriveId, getSharePointToken } from "@/lib/sharepoint-check";

/* ------------------------------------------------------------------ */
/* POST /api/dms/download-zip                                           */
/*                                                                      */
/* Body: { ids: string[], type: "file" | "folder" | "mixed" }         */
/* Streams a ZIP file containing all selected files/folders.           */
/* Max 100 files. Maintains folder structure inside ZIP.               */
/* ------------------------------------------------------------------ */

const MAX_FILES = 100;

interface ZipEntry {
  name:        string;
  folder_path: string;
  zipPath:     string;
}

/* Recursively collects all DmsDocument records under a folder.
   DmsDocument has no FK to DmsFolder; the relationship is by folder_path. */
async function collectFolderFiles(
  folder_id:   string,
  folder_path: string,   // DmsFolder.path — used to match DmsDocument.folder_path
  company_id:  string,
  zipPrefix:   string,
  results:     ZipEntry[],
): Promise<void> {
  if (results.length >= MAX_FILES) return;

  const [subFolders, docs] = await Promise.all([
    prisma.dmsFolder.findMany({
      where:  { company_id, parent_id: folder_id },
      select: { id: true, name: true, path: true },
    }),
    prisma.dmsDocument.findMany({
      where:  { company_id, folder_path },
      select: { name: true, folder_path: true },
    }),
  ]);

  for (const doc of docs) {
    if (results.length >= MAX_FILES) break;
    results.push({ name: doc.name, folder_path: doc.folder_path, zipPath: `${zipPrefix}${doc.name}` });
  }

  for (const sub of subFolders) {
    if (results.length >= MAX_FILES) break;
    await collectFolderFiles(sub.id, sub.path, company_id, `${zipPrefix}${sub.name}/`, results);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  /* --- Parse body -------------------------------------------------- */
  let body: { ids?: unknown; type?: unknown };
  try {
    body = await req.json() as { ids?: unknown; type?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const ids  = body.ids;
  const type = (body.type as string) ?? "mixed";

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array." }, { status: 400 });
  }
  if (ids.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Cannot download more than ${MAX_FILES} items at once.` },
      { status: 400 },
    );
  }

  /* --- Resolve SharePoint credentials once ------------------------- */
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

  /* --- Collect all file entries for the ZIP ----------------------- */
  const entries: ZipEntry[] = [];

  for (const rawId of ids as string[]) {
    if (entries.length >= MAX_FILES) break;

    /* Try as folder (for "folder" or "mixed" types) */
    if (type !== "file") {
      const folder = await prisma.dmsFolder.findFirst({
        where:  { id: rawId, company_id },
        select: { id: true, name: true, path: true },
      });
      if (folder) {
        await collectFolderFiles(folder.id, folder.path, company_id, `${folder.name}/`, entries);
        continue;
      }
    }

    /* Try as file */
    const doc = await prisma.dmsDocument.findFirst({
      where:  { id: rawId, company_id },
      select: { name: true, folder_path: true },
    });
    if (doc) {
      entries.push({ name: doc.name, folder_path: doc.folder_path, zipPath: doc.name });
    }
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "No accessible files found to download." }, { status: 404 });
  }

  /* --- Set up streaming ZIP ---------------------------------------- */
  const pass    = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 6 } });

  archive.on("error", (err: Error) => {
    console.error("[download-zip] archiver error:", err);
    pass.destroy(err);
  });

  archive.pipe(pass);

  /* Asynchronously fetch each file from SharePoint and add to archive */
  (async () => {
    for (const entry of entries) {
      try {
        const folderPath = entry.folder_path.replace(/^\/+|\/+$/g, "");
        const graphUrl   =
          `https://graph.microsoft.com/v1.0/drives/${drive_id}/root:/${folderPath}/${encodeURIComponent(entry.name)}:/content`;

        const spRes = await fetch(graphUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
          redirect: "follow",
        });

        if (!spRes.ok || !spRes.body) {
          console.warn(`[download-zip] Skipping "${entry.zipPath}": SharePoint ${spRes.status}`);
          continue;
        }

        const nodeStream = Readable.fromWeb(
          spRes.body as import("stream/web").ReadableStream,
        );
        archive.append(nodeStream, { name: entry.zipPath });
      } catch (err) {
        console.warn(`[download-zip] Skipping "${entry.zipPath}":`, err);
      }
    }

    await archive.finalize();
  })().catch((err: Error) => {
    console.error("[download-zip] Fatal streaming error:", err);
    pass.destroy(err);
  });

  /* Convert Node Readable → Web ReadableStream for Response body */
  const webStream = Readable.toWeb(pass) as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type":        "application/zip",
      "Content-Disposition": 'attachment; filename="download.zip"',
      "Cache-Control":       "private, no-store",
    },
  });
}

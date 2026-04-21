import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import { validateUpload } from "@/lib/dms-validation";
import { getDriveId, getSharePointToken } from "@/lib/sharepoint-check";
import { checkFolderAccess } from "@/lib/dms-permission";
import { logDmsActivity } from "@/lib/dms-activity";

/* ------------------------------------------------------------------ */
/* POST /api/dms/upload                                                 */
/* Content-Type: multipart/form-data                                   */
/* Fields: file (one or many), folder_id                               */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  /* 1. Parse multipart body ---------------------------------------- */
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data." }, { status: 400 });
  }

  const folder_id = (form.get("folder_id") ?? "") as string;
  if (!folder_id) {
    return NextResponse.json({ error: "folder_id is required." }, { status: 400 });
  }

  const rawFiles = form.getAll("file") as File[];
  if (rawFiles.length === 0) {
    return NextResponse.json({ error: "At least one file is required." }, { status: 400 });
  }

  /* 2. Validate against DmsSettings --------------------------------- */
  try {
    await validateUpload(
      rawFiles.map((f) => ({ name: f.name, size: f.size })),
      company_id,
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 422 },
    );
  }

  /* 3. Fetch folder ------------------------------------------------- */
  const folder = await prisma.dmsFolder.findUnique({ where: { id: folder_id } });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  if (folder.company_id !== company_id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  /* 3a. Permission check — require can_upload ----------------------- */
  /* USER folders: owner always has full access — no perm table query */
  const isOwnerUserFolder =
    folder.type === "USER" && folder.created_by === user_id;

  if (!isOwnerUserFolder) {
    const access = await checkFolderAccess(auth.user, folder_id);
    if (!access.can_upload) {
      return NextResponse.json(
        { error: "You do not have permission to upload files to this folder." },
        { status: 403 },
      );
    }
  }

  /* 4. Resolve drive ID + access token (parallel) ------------------- */
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

  /* 5. Upload each file to SharePoint & save metadata --------------- */
  const uploaded: {
    id:          string;
    name:        string;
    file_url:    string;
    folder_path: string;
    uploaded_by: string;
  }[] = [];

  const folderPath = folder.path.replace(/^\/+|\/+$/g, ""); // trim slashes

  for (const file of rawFiles) {
    const filename  = file.name;
    const uploadUrl =
      `https://graph.microsoft.com/v1.0/drives/${drive_id}/root:/${folderPath}/${filename}:/content`;

    let fileUrl:  string;
    let spItemId: string | null = null;
    try {
      const arrayBuffer = await file.arrayBuffer();

      const uploadRes = await fetch(uploadUrl, {
        method:  "PUT",
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/octet-stream",
        },
        body: arrayBuffer,
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({})) as { error?: { message?: string } };
        return NextResponse.json(
          {
            error: `Failed to upload "${filename}": ${
              errJson?.error?.message ?? uploadRes.statusText
            }`,
          },
          { status: 502 },
        );
      }

      const spFile = await uploadRes.json() as {
        id?:     string;   // DriveItem.id — stable identifier for the item
        webUrl?: string;
      };
      fileUrl           = spFile.webUrl ?? uploadUrl;
      spItemId          = spFile.id ?? null;

    } catch (e: unknown) {
      return NextResponse.json(
        { error: `Upload error for "${filename}": ${(e as Error).message}` },
        { status: 502 },
      );
    }

    /* Save metadata to DmsDocument ---------------------------------- */
    const doc = await prisma.dmsDocument.create({
      data: {
        company_id,
        name:               filename,
        file_url:           fileUrl,
        folder_path:        folderPath,
        uploaded_by:        user_id,
        sharepoint_item_id: spItemId,
        drive_id,
      },
    });

    void logDmsActivity({
      company_id, user_id,
      action:      "UPLOAD_FILE",
      entity_type: "file",
      entity_id:   doc.id,
      entity_name: doc.name,
    });

    uploaded.push({
      id:          doc.id,
      name:        doc.name,
      file_url:    doc.file_url,
      folder_path: doc.folder_path,
      uploaded_by: doc.uploaded_by,
    });
  }

  /* 6. Return uploaded file list ------------------------------------ */
  return NextResponse.json({ success: true, uploaded });
}

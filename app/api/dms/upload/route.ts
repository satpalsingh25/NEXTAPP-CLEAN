import { NextRequest, NextResponse } from "next/server";
import { prisma }             from "@/lib/prisma";
import { requireAuth }        from "@/lib/auth.server";
import { validateUpload }     from "@/lib/dms-validation";
import { getDriveId, getSharePointToken } from "@/lib/sharepoint-check";
import { checkFolderAccess }  from "@/lib/dms-permission";
import { logDmsActivity }     from "@/lib/dms-activity";
import { gateModule }         from "@/lib/module-access";
import { logAudit }           from "@/lib/audit-log";
import { checkRateLimit }     from "@/lib/rate-limit";
import { validateUUID, validateFileName, validateFileExtension, ValidationError } from "@/lib/validation";
import { errorResponse, generateRequestId, SP_ERRORS } from "@/lib/api-response";
import { logInternalError } from "@/lib/error-log";

/* ------------------------------------------------------------------ */
/* POST /api/dms/upload                                                 */
/* Content-Type: multipart/form-data                                   */
/* Fields: file (one or many), folder_id                               */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "DMS");
  if (gate) return gate;
  const { company_id, user_id } = auth.user;

  /* Rate limit — upload is expensive; 20 / 15 min */
  const rl = checkRateLimit(user_id, "dms-upload", "upload");
  if (rl) return rl;

  /* 1. Parse multipart body ---------------------------------------- */
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data." }, { status: 400 });
  }

  const folder_id = (form.get("folder_id") ?? "") as string;

  /* 2. Validate inputs --------------------------------------------- */
  try {
    validateUUID(folder_id, "folder_id");
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const rawFiles = form.getAll("file") as File[];
  if (rawFiles.length === 0) {
    return NextResponse.json({ error: "At least one file is required." }, { status: 400 });
  }

  /* Validate each file name + extension before touching SharePoint */
  for (const file of rawFiles) {
    try {
      validateFileName(file.name);
      validateFileExtension(file.name);
    } catch (e) {
      if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  }

  /* 3. Validate against DmsSettings (max size, max file count) ------ */
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

  /* 4. Fetch folder ------------------------------------------------- */
  const folder = await prisma.dmsFolder.findUnique({ where: { id: folder_id } });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  if (folder.company_id !== company_id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  /* 4a. Permission check — require can_upload ----------------------- */
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

  /* 5. Resolve drive ID + access token (parallel) ------------------- */
  let drive_id:    string;
  let accessToken: string;
  try {
    [drive_id, accessToken] = await Promise.all([
      getDriveId(company_id),
      getSharePointToken(company_id),
    ]);
  } catch (e: unknown) {
    const requestId = generateRequestId();
    logInternalError(e, { route: "POST /api/dms/upload", user_id, company_id, request_id: requestId });
    return errorResponse(SP_ERRORS.CONFIG, 502, requestId);
  }

  /* 6. Upload each file to SharePoint & save metadata --------------- */
  const uploaded: {
    id:          string;
    name:        string;
    file_url:    string;
    folder_path: string;
    uploaded_by: string;
  }[] = [];

  const folderPath = folder.path.replace(/^\/+|\/+$/g, "");

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
        const requestId = generateRequestId();
        logInternalError(
          new Error(`SharePoint upload failed for "${filename}": ${errJson?.error?.message ?? uploadRes.statusText}`),
          { route: "POST /api/dms/upload", user_id, company_id, request_id: requestId, meta: { filename, status: uploadRes.status } },
        );
        return errorResponse(SP_ERRORS.UPLOAD, 502, requestId);
      }

      const spFile = await uploadRes.json() as {
        id?:     string;
        webUrl?: string;
      };
      fileUrl  = spFile.webUrl ?? uploadUrl;
      spItemId = spFile.id ?? null;

    } catch (e: unknown) {
      const requestId = generateRequestId();
      logInternalError(e, { route: "POST /api/dms/upload", user_id, company_id, request_id: requestId, meta: { filename } });
      return errorResponse(SP_ERRORS.UPLOAD, 502, requestId);
    }

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
    void logAudit({ company_id, user_id, action: "UPLOAD_FILE", module: "DMS", entity_type: "file", entity_id: doc.id, description: `Uploaded file ${doc.name}` });

    uploaded.push({
      id:          doc.id,
      name:        doc.name,
      file_url:    doc.file_url,
      folder_path: doc.folder_path,
      uploaded_by: doc.uploaded_by,
    });
  }

  return NextResponse.json({ success: true, uploaded });
}

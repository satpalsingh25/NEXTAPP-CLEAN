import { NextRequest, NextResponse } from "next/server";
import { prisma }             from "@/lib/prisma";
import { requireAuth }        from "@/lib/auth.server";
import { validateUpload }     from "@/lib/dms-validation";
import { uploadDmsFile } from "@/lib/storage/storage-service";
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

  /* 5. Upload each file via storage service & save metadata --------- */
  const uploaded: {
    id:          string;
    name:        string;
    file_url:    string;
    folder_path: string;
    uploaded_by: string;
  }[] = [];

  const folderPath = folder.path.replace(/^\/+|\/+$/g, "");

  for (const file of rawFiles) {
    const filename = file.name;

    let uploadResult: { fileId: string; webUrl: string; driveId: string; filePath: string };
    try {
      uploadResult = await uploadDmsFile({
        companyId:  company_id,
        folderPath,
        fileName:   filename,
        file,
      });
    } catch (e: unknown) {
      const requestId = generateRequestId();
      const msg = (e as Error).message ?? "";
      const isCfg = msg.toLowerCase().includes("not configured") || msg.toLowerCase().includes("config");
      logInternalError(e, {
        route:      "POST /api/dms/upload",
        user_id,
        company_id,
        request_id: requestId,
        meta:       { filename },
      });
      return errorResponse(isCfg ? SP_ERRORS.CONFIG : SP_ERRORS.UPLOAD, 502, requestId);
    }

    const doc = await prisma.dmsDocument.create({
      data: {
        company_id,
        name:                filename,
        file_url:            uploadResult.webUrl,
        folder_path:         folderPath,
        uploaded_by:         user_id,
        sharepoint_item_id:  uploadResult.fileId || null,
        drive_id:            uploadResult.driveId,
        storage_provider_id: uploadResult.storage_provider_id ?? null,
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

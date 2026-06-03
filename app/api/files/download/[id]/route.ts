import { NextRequest, NextResponse } from "next/server";
import { errorResponse, generateRequestId, SP_ERRORS } from "@/lib/api-response";
import { logInternalError } from "@/lib/error-log";
import { prisma }                   from "@/lib/prisma";
import { requireAuth }              from "@/lib/auth.server";
import { getDriveId, getSharePointToken } from "@/lib/sharepoint-check";
import { logAudit }                from "@/lib/audit-log";
import { checkRateLimit }          from "@/lib/rate-limit";
import { validateUUID, ValidationError } from "@/lib/validation";
import path                        from "path";

/* ------------------------------------------------------------------ */
/* MIME fallback map (used when SharePoint omits Content-Type)          */
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
  doc:  "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls:  "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt:  "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip:  "application/zip",
  rar:  "application/x-rar-compressed",
};

function mimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/* ------------------------------------------------------------------ */
/* GET /api/files/download/[id]                                         */
/*                                                                      */
/* Securely serves a Document record (Compliance/AMC) as an attachment. */
/* Never exposes raw SharePoint URLs or internal paths to the client.   */
/* ------------------------------------------------------------------ */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  /* 1. Authentication ------------------------------------------------ */
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  /* Rate limit — 100 downloads / 15 min per user */
  const rlCheck = checkRateLimit(user_id, "files-download", "files");
  if (rlCheck) return rlCheck;

  const { id } = await params;

  /* 1b. Validate id format ------------------------------------------ */
  try {
    validateUUID(id, "file id");
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  /* 2. Fetch Document record + cross-tenant guard ------------------- */
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  if (doc.company_id !== company_id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  /* 3. Derive filename and folder path from stored file_path -------- */
  /*    file_path is stored as: /Company/{co}/Compliance/{id}/{file}   */
  const filename   = path.basename(doc.file_path);
  const folderPath = path.dirname(doc.file_path).replace(/^\/+|\/+$/g, "");

  /* 4. Resolve SharePoint credentials ------------------------------- */
  let drive_id: string;
  let accessToken: string;
  try {
    [drive_id, accessToken] = await Promise.all([
      getDriveId(company_id),
      getSharePointToken(company_id),
    ]);
  } catch (e: unknown) {
    const requestId = generateRequestId();
    logInternalError(e, { route: "GET /api/files/download/[id]", user_id, company_id, request_id: requestId, meta: { doc_id: doc.id } });
    return errorResponse(SP_ERRORS.CONFIG, 502, requestId);
  }

  /* 5. Fetch file content from Microsoft Graph API ------------------ */
  /*    Fast path: use itemId if available (skips path lookup).       */
  /*    Fallback: reconstruct URL from stored file_path (legacy).     */
  const graphUrl = doc.external_file_id
    ? `https://graph.microsoft.com/v1.0/drives/${drive_id}/items/${doc.external_file_id}/content`
    : `https://graph.microsoft.com/v1.0/drives/${drive_id}/root:/${folderPath}/${encodeURIComponent(filename)}:/content`;

  let spRes: Response;
  try {
    spRes = await fetch(graphUrl, {
      headers:  { Authorization: `Bearer ${accessToken}` },
      redirect: "follow",
    });
  } catch (e: unknown) {
    const requestId = generateRequestId();
    logInternalError(e, { route: "GET /api/files/download/[id]", user_id, company_id, request_id: requestId });
    return errorResponse(SP_ERRORS.NETWORK, 502, requestId);
  }

  if (!spRes.ok) {
    const errJson = await spRes.json().catch(() => ({})) as { error?: { message?: string } };
    const requestId = generateRequestId();
    logInternalError(
      new Error(`SharePoint ${spRes.status}: ${errJson?.error?.message ?? spRes.statusText}`),
      { route: "GET /api/files/download/[id]", user_id, company_id, request_id: requestId, meta: { status: spRes.status } },
    );
    return errorResponse(SP_ERRORS.FETCH, 502, requestId);
  }

  /* 6. Audit log (fire-and-forget) ---------------------------------- */
  void logAudit({
    company_id,
    user_id,
    action:      "DOWNLOAD_FILE",
    module:      doc.module,
    entity_type: "document",
    entity_id:   doc.id,
    description: `Downloaded ${filename}`,
  });

  /* 7. Return as forced download attachment -------------------------- */
  const contentType = spRes.headers.get("Content-Type") ?? mimeFromName(filename);
  return new NextResponse(spRes.body, {
    status: 200,
    headers: {
      "Content-Type":        contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "private, no-store",
      ...(spRes.headers.get("Content-Length")
        ? { "Content-Length": spRes.headers.get("Content-Length")! }
        : {}),
    },
  });
}

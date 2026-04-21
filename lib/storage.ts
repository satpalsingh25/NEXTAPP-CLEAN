import { getDriveId, getSharePointToken } from "@/lib/sharepoint-check";

/* ================================================================== */
/*  Central Storage Service                                             */
/*                                                                      */
/*  Single entry point for uploading files to SharePoint across all    */
/*  modules (DMS, AMC, COMPLIANCE). Handles path construction,         */
/*  SharePoint credential resolution, and the Graph API upload PUT.    */
/* ================================================================== */

export type StorageModule = "DMS" | "AMC" | "COMPLIANCE";

export interface UploadFileInput {
  /** Web API File object (from FormData) */
  file:        File;
  /** Explicit filename — may differ from file.name (e.g. sanitised) */
  fileName:    string;
  /** MIME type string, e.g. "application/pdf" */
  mimeType:    string;
  /** Tenant company UUID */
  company_id:  string;
  /** Uploading user UUID (for audit purposes) */
  user_id:     string;
  /** Which product module is uploading */
  module:      StorageModule;
  /**
   * DMS     — not used (parent_path carries the full folder path)
   * AMC     — AMC record UUID; folder becomes /AMC/{record_id}/
   * COMPLIANCE — compliance record UUID; folder becomes /Compliance/{record_id}/
   */
  record_id?:  string;
  /**
   * DMS only — the DmsFolder.path value, e.g. "/users/abc123/Reports".
   * Already structured; appended directly after the company root.
   */
  parent_path?: string;
}

export interface UploadFileResult {
  /** Stored filename */
  name:             string;
  /** Full logical path inside the SharePoint drive, e.g. /Company/…/file.pdf */
  path:             string;
  /** MIME type as supplied by the caller */
  mimeType:         string;
  /** File size in bytes */
  size:             number;
  /** SharePoint DriveItem.id — stable reference for future Graph calls */
  sharePointItemId: string | null;
  /** SharePoint webUrl — browser-accessible link to the file */
  webUrl:           string;
}

/* ------------------------------------------------------------------ */
/* uploadFile                                                           */
/* ------------------------------------------------------------------ */

/**
 * Uploads a file to the company's SharePoint document library.
 *
 * Path structure per module:
 *   DMS         → /Company/{company_id}{parent_path}/{fileName}
 *   AMC         → /Company/{company_id}/AMC/{record_id}/{fileName}
 *   COMPLIANCE  → /Company/{company_id}/Compliance/{record_id}/{fileName}
 *
 * Throws on SharePoint credential failure or Graph API upload error.
 */
export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
  const { file, fileName, mimeType, company_id, module, record_id, parent_path } = input;

  /* ── Step 1: Build base path ───────────────────────────────────── */
  let basePath = `/Company/${company_id}`;

  /* ── Step 2: Append module-specific segment ────────────────────── */
  if (module === "COMPLIANCE") {
    if (!record_id) throw new Error("record_id is required for COMPLIANCE uploads.");
    basePath += `/Compliance/${record_id}`;
  } else if (module === "AMC") {
    if (!record_id) throw new Error("record_id is required for AMC uploads.");
    basePath += `/AMC/${record_id}`;
  } else {
    /* DMS — parent_path is already the full structured folder path */
    const normalised = (parent_path ?? "").replace(/\/+$/, ""); // strip trailing slash
    basePath += normalised;
  }

  /* ── Step 3: Final logical path ────────────────────────────────── */
  const fullPath = `${basePath}/${fileName}`;

  /* ── Step 4: Resolve SharePoint credentials ────────────────────── */
  const [drive_id, accessToken] = await Promise.all([
    getDriveId(company_id),
    getSharePointToken(company_id),
  ]);

  /* Build the Graph API upload URL.
     Strip leading/trailing slashes from the folder segment so the URL
     is valid: /drives/{id}/root:/{folder}/{filename}:/content          */
  const folderSegment = basePath.replace(/^\/+|\/+$/g, "");
  const uploadUrl     =
    `https://graph.microsoft.com/v1.0/drives/${drive_id}/root:/${folderSegment}/${encodeURIComponent(fileName)}:/content`;

  /* ── Step 5: Upload to SharePoint ──────────────────────────────── */
  const arrayBuffer = await file.arrayBuffer();

  const spRes = await fetch(uploadUrl, {
    method:  "PUT",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: arrayBuffer,
  });

  if (!spRes.ok) {
    const errJson = await spRes.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(
      `SharePoint upload failed for "${fileName}": ${
        errJson?.error?.message ?? spRes.statusText
      }`,
    );
  }

  const spFile = await spRes.json() as { id?: string; webUrl?: string };

  /* ── Step 6: Return metadata ───────────────────────────────────── */
  return {
    name:             fileName,
    path:             fullPath,
    mimeType,
    size:             file.size,
    sharePointItemId: spFile.id ?? null,
    webUrl:           spFile.webUrl ?? uploadUrl,
  };
}

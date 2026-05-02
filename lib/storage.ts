import { prisma }                   from "@/lib/prisma";
import { getDriveId, getSharePointToken } from "@/lib/sharepoint-check";

/* ================================================================== */
/*  Central Storage Service                                             */
/*                                                                      */
/*  Uploads files to SharePoint using human-readable, slug-safe paths. */
/*  Path is built from company.name / user.name (never raw UUIDs).    */
/*                                                                      */
/*  Path structure per module:                                          */
/*    DMS (with parent_path)  → /Company/{co}/…DMS folder path…/{file} */
/*    DMS (My Files root)     → /Company/{co}/Users/{user}/{file}       */
/*    COMPLIANCE              → /Company/{co}/Compliance/{record}/{file}*/
/*    AMC                     → /Company/{co}/AMC/{record}/{file}       */
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
  /** Uploading user UUID */
  user_id:     string;
  /** Which product module is uploading */
  module:      StorageModule;
  /**
   * AMC / COMPLIANCE — the linked record UUID.
   * Required for those modules.
   */
  record_id?:  string;
  /**
   * DMS only — the DmsFolder.path value of the target folder
   * (e.g. "users/abc123/Reports"). When provided the path is used
   * as-is after the company root. When absent, falls back to
   * /Users/{slugified_user_name}.
   */
  parent_path?: string;
}

export interface UploadFileResult {
  /** Stored filename */
  name:             string;
  /** Full logical path inside the SharePoint drive */
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
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/**
 * Converts a human-readable name into a safe SharePoint folder segment.
 * • Trims whitespace
 * • Replaces runs of whitespace with "_"
 * • Removes every character that isn't alphanumeric, underscore,
 *   hyphen, or period
 * • Falls back to "unknown" if the result is empty
 */
function slugify(str: string): string {
  const result = str
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-.]/g, "");
  return result || "unknown";
}

/**
 * Ensures a folder at `path` exists inside the SharePoint drive.
 *
 * Steps:
 *  1. GET the folder — if 200, it already exists; return immediately.
 *  2. If 404, POST to create it with conflictBehavior "replace" so a
 *     race-condition duplicate create does not throw.
 *  3. Any other status from GET is treated as a non-fatal warning
 *     (the subsequent upload PUT will surface the real error if it fails).
 *
 * @param path  Slash-separated path WITHOUT leading slash,
 *              e.g. "Company/ABC_Ltd/Users"
 */
async function ensureSharePointFolder(
  drive_id:    string,
  accessToken: string,
  path:        string,
): Promise<void> {
  const checkUrl = `https://graph.microsoft.com/v1.0/drives/${drive_id}/root:/${path}`;
  const checkRes = await fetch(checkUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (checkRes.ok) return; // folder already exists

  if (checkRes.status !== 404) {
    // Non-fatal: log and continue — the upload PUT will fail if the folder
    // truly cannot be accessed.
    console.warn(`[storage] ensureSharePointFolder: unexpected status ${checkRes.status} for "${path}"`);
    return;
  }

  /* Folder not found — create it */
  const lastSlash  = path.lastIndexOf("/");
  const folderName = path.substring(lastSlash + 1);
  const parentPath = lastSlash > 0 ? path.substring(0, lastSlash) : "";

  const createUrl = parentPath
    ? `https://graph.microsoft.com/v1.0/drives/${drive_id}/root:/${parentPath}:/children`
    : `https://graph.microsoft.com/v1.0/drives/${drive_id}/root/children`;

  const createRes = await fetch(createUrl, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name:   folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "replace",
    }),
  });

  if (!createRes.ok && createRes.status !== 409) {
    const errJson = await createRes.json().catch(() => ({})) as { error?: { message?: string } };
    console.warn(
      `[storage] ensureSharePointFolder: could not create "${path}": ${
        errJson?.error?.message ?? createRes.statusText
      }`,
    );
    // Non-fatal — upload will surface the error if it truly fails.
  }
}

/* ------------------------------------------------------------------ */
/* uploadFile                                                           */
/* ------------------------------------------------------------------ */

export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
  const { file, fileName, mimeType, company_id, user_id, module, record_id, parent_path } = input;

  /* ── Step 1: Fetch company name ────────────────────────────────── */
  const company = await prisma.company.findUnique({
    where:  { id: company_id },
    select: { name: true },
  });
  if (!company) throw new Error(`Company not found: ${company_id}`);

  const companySlug = slugify(company.name);

  /* ── Step 2: Build module-specific base path ───────────────────── */
  let basePath = `Company/${companySlug}`;

  if (module === "COMPLIANCE") {
    if (!record_id) throw new Error("record_id is required for COMPLIANCE uploads.");
    basePath += `/Compliance/${record_id}`;

  } else if (module === "AMC") {
    if (!record_id) throw new Error("record_id is required for AMC uploads.");
    basePath += `/AMC/${record_id}`;

  } else {
    /* DMS */
    if (parent_path) {
      /* Target is an explicit DMS folder — append its path directly */
      const normalised = parent_path.replace(/^\/+|\/+$/g, "");
      basePath += `/${normalised}`;
    } else {
      /* My Files root — store under /Users/{user_name} */
      const user = await prisma.user.findUnique({
        where:  { id: user_id },
        select: { name: true },
      });
      const userSlug = slugify(user?.name ?? user_id);
      basePath += `/Users/${userSlug}`;
    }
  }

  /* ── Step 3: Full logical path ─────────────────────────────────── */
  const fullPath = `/${basePath}/${fileName}`;

  /* ── Step 4: Resolve SharePoint credentials ────────────────────── */
  const [drive_id, accessToken] = await Promise.all([
    getDriveId(company_id),
    getSharePointToken(company_id),
  ]);

  /* ── Step 5: Ensure base folder structure exists ───────────────── */
  /* Folders are created parent-first (sequential) so each level     */
  /* can rely on its parent existing before it is created.           */
  const baseFolders = [
    "Company",
    `Company/${companySlug}`,
    `Company/${companySlug}/Users`,
    `Company/${companySlug}/TeamFolder`,
    `Company/${companySlug}/Compliance`,
    `Company/${companySlug}/AMC`,
  ];

  for (const folder of baseFolders) {
    await ensureSharePointFolder(drive_id, accessToken, folder);
  }

  /* ── Step 6: Upload file to SharePoint ─────────────────────────── */
  const uploadUrl =
    `https://graph.microsoft.com/v1.0/drives/${drive_id}/root:/${basePath}/${encodeURIComponent(fileName)}:/content`;

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

  /* ── Step 7: Return metadata ───────────────────────────────────── */
  return {
    name:             fileName,
    path:             fullPath,
    mimeType,
    size:             file.size,
    sharePointItemId: spFile.id ?? null,
    webUrl:           spFile.webUrl ?? uploadUrl,
  };
}

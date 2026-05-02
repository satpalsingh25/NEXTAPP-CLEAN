import { prisma } from "@/lib/prisma";
import { decryptPassword } from "@/lib/smtp-crypto";

/* ------------------------------------------------------------------ */
/* checkSharePointConfigured                                            */
/* ------------------------------------------------------------------ */

/**
 * Returns true if a SharePointConfig record exists for the given company.
 * Use as a guard before any SharePoint operation.
 */
export async function checkSharePointConfigured(company_id: string): Promise<boolean> {
  const config = await prisma.sharePointConfig.findUnique({
    where:  { company_id },
    select: { id: true },
  });
  return config !== null;
}

/* ------------------------------------------------------------------ */
/* getSharePointToken                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetches the SharePointConfig for the company, decrypts the client secret,
 * and obtains a Graph API access token via the client_credentials flow.
 *
 * Throws if the config is missing or the token request fails.
 */
export async function getSharePointToken(company_id: string): Promise<string> {
  const config = await prisma.sharePointConfig.findUnique({ where: { company_id } });
  if (!config) throw new Error("SharePoint is not configured for this company.");

  const clientSecret = decryptPassword(config.client_secret);
  if (!clientSecret) throw new Error("Unable to decrypt SharePoint client secret.");

  const res = await fetch(
    `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     config.client_id,
        client_secret: clientSecret,
        scope:         "https://graph.microsoft.com/.default",
      }),
    },
  );

  const json = await res.json() as { access_token?: string; error_description?: string; error?: string };
  if (!json.access_token) {
    throw new Error(json.error_description ?? json.error ?? "Failed to obtain SharePoint access token.");
  }

  return json.access_token;
}

/* ------------------------------------------------------------------ */
/* getSiteId                                                            */
/* ------------------------------------------------------------------ */

/**
 * Resolves the Graph API site ID for the company's configured SharePoint site.
 *
 * Steps:
 *  1. Reads site_url from SharePointConfig (e.g. https://tenant.sharepoint.com/sites/TestSite)
 *  2. Extracts hostname  → tenant.sharepoint.com
 *              site_path → /sites/TestSite
 *  3. Calls GET https://graph.microsoft.com/v1.0/sites/{hostname}:{site_path}
 *  4. Returns site.id
 *
 * Throws on config missing, token failure, or Graph API error.
 */
export async function getSiteId(company_id: string): Promise<string> {
  const config = await prisma.sharePointConfig.findUnique({
    where:  { company_id },
    select: { site_url: true },
  });
  if (!config) throw new Error("SharePoint is not configured for this company.");

  /* Parse site_url into hostname + path */
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(config.site_url.trim());
  } catch {
    throw new Error(`Invalid SharePoint site_url: "${config.site_url}".`);
  }

  const hostname  = parsedUrl.hostname;                    // e.g. tenant.sharepoint.com
  const site_path = parsedUrl.pathname.replace(/\/$/, ""); // e.g. /sites/TestSite

  if (!hostname || !site_path || site_path === "/") {
    throw new Error(`Cannot extract site path from site_url: "${config.site_url}".`);
  }

  /* Get access token */
  const accessToken = await getSharePointToken(company_id);

  /* Call Graph API */
  const graphUrl = `https://graph.microsoft.com/v1.0/sites/${hostname}:${site_path}`;
  const res = await fetch(graphUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const site = await res.json() as { id?: string; error?: { message?: string } };

  if (!res.ok || !site.id) {
    throw new Error(
      site.error?.message ?? `Graph API returned ${res.status} for site lookup.`,
    );
  }

  return site.id;
}

/* ------------------------------------------------------------------ */
/* getDriveId                                                           */
/* ------------------------------------------------------------------ */

/**
 * Resolves the Graph API drive ID for the company's configured document library.
 *
 * Steps:
 *  1. Calls getSiteId() to get the site ID
 *  2. Lists all drives on that site via GET /sites/{site_id}/drives
 *  3. Finds the drive whose name matches SharePointConfig.document_library
 *  4. Returns drive.id
 *
 * Throws if the config is missing, the drives call fails, or no drive matches.
 */
export async function getDriveId(company_id: string): Promise<string> {
  const config = await prisma.sharePointConfig.findUnique({
    where:  { company_id },
    select: { document_library: true },
  });
  if (!config) throw new Error("SharePoint is not configured for this company.");

  const site_id     = await getSiteId(company_id);
  const accessToken = await getSharePointToken(company_id);

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${site_id}/drives`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const body = await res.json() as {
    value?: { id: string; name: string }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(
      body.error?.message ?? `Graph API returned ${res.status} when listing drives.`,
    );
  }

  const drives  = body.value ?? [];
  const matched = drives.find(
    (d) => d.name.toLowerCase() === config.document_library.toLowerCase(),
  );

  if (!matched) {
    throw new Error(
      `Document library "${config.document_library}" not found in site drives. ` +
      `Available: ${drives.map((d) => d.name).join(", ") || "(none)"}`,
    );
  }

  return matched.id;
}

/* ------------------------------------------------------------------ */
/* createFolder                                                         */
/* ------------------------------------------------------------------ */

/** Shape of the relevant fields returned by Graph when creating a folder. */
export interface SharePointFolder {
  id:     string;
  name:   string;
  webUrl: string;
}

/**
 * Creates a folder inside the company's SharePoint document library.
 *
 * Steps:
 *  1. Resolves drive_id via getDriveId()
 *  2. POSTs to POST /drives/{drive_id}/root:/{parent_path}:/children
 *     with conflictBehavior = "rename" so duplicate names are auto-renamed
 *     rather than causing an error.
 *  3. Returns { id, name, webUrl } from the Graph API response.
 *
 * @param company_id   Tenant company UUID
 * @param parent_path  Path of the parent folder inside the drive root
 *                     (e.g. "users/abc123" or "users/abc123/reports").
 *                     Use "" or "/" to target the drive root directly.
 * @param folder_name  Display name of the new folder.
 */
export async function createFolder(
  company_id:  string,
  parent_path: string,
  folder_name: string,
): Promise<SharePointFolder> {
  const [drive_id, accessToken] = await Promise.all([
    getDriveId(company_id),
    getSharePointToken(company_id),
  ]);

  /* Build the endpoint — strip leading/trailing slashes from parent_path */
  const normalised = parent_path.replace(/^\/+|\/+$/g, "");
  const folderPath = normalised ? `${normalised}/${folder_name}` : folder_name;
  const endpoint   = normalised
    ? `https://graph.microsoft.com/v1.0/drives/${drive_id}/root:/${normalised}:/children`
    : `https://graph.microsoft.com/v1.0/drives/${drive_id}/root/children`;

  console.log("[createFolder] creating SharePoint folder", {
    company_id,
    folderPath,
    drive_id,
    endpoint,
  });

  const res = await fetch(endpoint, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name:   folder_name,
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename",
    }),
  });

  const json = await res.json() as {
    id?:     string;
    name?:   string;
    webUrl?: string;
    error?:  { message?: string };
  };

  console.log("[createFolder] Graph API response", {
    status:  res.status,
    ok:      res.ok,
    folderId: json.id ?? null,
    webUrl:  json.webUrl ?? null,
    error:   json.error ?? null,
  });

  if (!res.ok || !json.id) {
    const message =
      json.error?.message ??
      `Graph API returned ${res.status} when creating folder "${folder_name}".`;
    console.error("[createFolder] API error:", message, { company_id, folderPath, drive_id });
    throw new Error(message);
  }

  return { id: json.id, name: json.name!, webUrl: json.webUrl! };
}

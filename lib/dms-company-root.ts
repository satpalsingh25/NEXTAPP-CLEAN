import { prisma } from "@/lib/prisma";
import { checkSharePointConfigured, getDriveId, getSharePointToken } from "@/lib/sharepoint-check";

/**
 * Ensures the company root folder exists in both SharePoint and the DB.
 *
 * SharePoint validation (when configured):
 *   1. GET  root:/{company_folder_name}  — check if folder already exists.
 *      If it exists  → skip creation (do NOT POST).
 *      If it is 404  → POST root/children to create it.
 *      Any other err → throw (propagates to the caller).
 *
 * DB write:
 *   Attempted after the SharePoint step regardless of whether SharePoint
 *   created the folder or found it already there.
 *   Duplicate/race-condition inserts are silently ignored.
 */
export async function ensureCompanyRootFolder(
  company_id:          string,
  company_folder_name: string,
  user_id:             string,
): Promise<void> {
  /* ── 1. Check DB — bail early if already exists ─────────────────── */
  const existing = await prisma.dmsFolder.findFirst({
    where:  { company_id, parent_id: null, name: company_folder_name },
    select: { id: true },
  });

  if (existing) return;

  /* ── 2. SharePoint check + conditional create ────────────────────── */
  const spConfigured = await checkSharePointConfigured(company_id);

  if (spConfigured) {
    const [drive_id, accessToken] = await Promise.all([
      getDriveId(company_id),
      getSharePointToken(company_id),
    ]);

    /* ── 2a. GET root:/{company_folder_name} — validate existence ──── */
    const checkRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${drive_id}/root:/${encodeURIComponent(company_folder_name)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (checkRes.ok) {
      /* Folder already exists in SharePoint — do NOT create again.
         Fall through to the DB insert so the record is synced.    */
      console.info(
        `[ensureCompanyRootFolder] "${company_folder_name}" already exists in SharePoint — skipping creation.`,
      );
    } else if (checkRes.status === 404) {
      /* ── 2b. Folder absent — create it ──────────────────────────── */
      const createRes = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${drive_id}/root/children`,
        {
          method:  "POST",
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name:   company_folder_name,
            folder: {},
            "@microsoft.graph.conflictBehavior": "fail",
          }),
        },
      );

      if (!createRes.ok) {
        const errJson = await createRes.json().catch(() => ({})) as {
          error?: { code?: string; message?: string };
        };
        /* nameAlreadyExists can still race between the GET and POST — treat as OK */
        if (errJson?.error?.code !== "nameAlreadyExists") {
          const message =
            errJson?.error?.message ??
            `Graph API returned ${createRes.status} when creating company root folder.`;
          throw new Error(message);
        }
      }
    } else {
      /* Unexpected error from the GET request */
      const errJson = await checkRes.json().catch(() => ({})) as {
        error?: { code?: string; message?: string };
      };
      const message =
        errJson?.error?.message ??
        `Graph API returned ${checkRes.status} when checking company root folder.`;
      throw new Error(message);
    }
  }

  /* ── 3. Insert DB record ─────────────────────────────────────────── */
  try {
    await prisma.dmsFolder.create({
      data: {
        company_id,
        name:       company_folder_name,
        path:       company_folder_name,
        type:       "COMPANY",
        parent_id:  null,
        created_by: user_id,
      },
    });
  } catch {
    /* Duplicate from race condition — already exists, nothing to do */
  }
}

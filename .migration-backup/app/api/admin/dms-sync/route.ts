import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";
import { getDriveId, getSharePointToken } from "@/lib/sharepoint-check";

/* ------------------------------------------------------------------ */
/* POST /api/admin/dms-sync                                            */
/*                                                                      */
/* One-time migration sync: reads root-level folders from SharePoint   */
/* and inserts any that do not already exist in DmsFolder.             */
/*                                                                      */
/* This endpoint is admin-only and intended for initial migration use  */
/* only — it should not be called on every request.                    */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  /* ── 1. Resolve SharePoint credentials ───────────────────────────── */
  let drive_id:    string;
  let accessToken: string;

  try {
    [drive_id, accessToken] = await Promise.all([
      getDriveId(company_id),
      getSharePointToken(company_id),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "SharePoint configuration error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  /* ── 2. Fetch root-level drive children from SharePoint (paginated) ─ */
  interface SpDriveItem {
    id:     string;
    name:   string;
    folder?: object;
  }
  interface SpResponse {
    value:           SpDriveItem[];
    "@odata.nextLink"?: string;
  }

  const spFolders: SpDriveItem[] = [];
  let   nextUrl: string | undefined =
    `https://graph.microsoft.com/v1.0/drives/${drive_id}/root/children`;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({})) as { error?: { message?: string } };
      const message = errJson?.error?.message ?? `Graph API returned ${res.status}.`;
      return NextResponse.json({ error: `Failed to list SharePoint folders: ${message}` }, { status: 502 });
    }

    const data = await res.json() as SpResponse;

    for (const item of data.value) {
      if (item.folder !== undefined) {
        spFolders.push(item);
      }
    }

    nextUrl = data["@odata.nextLink"];
  }

  /* ── 3. Load existing root TEAM folders for this company ─────────── */
  const company = await prisma.company.findUnique({
    where:  { id: company_id },
    select: { name: true, company_folder_name: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const companyFolder =
    company.company_folder_name?.trim() || company.name.replace(/\s+/g, "_");

  const existingFolders = await prisma.dmsFolder.findMany({
    where:   { company_id, type: "TEAM", parent_id: null },
    select:  { path: true },
  });
  const existingPaths = new Set(existingFolders.map((f) => f.path));

  /* ── 4. Insert missing folders ───────────────────────────────────── */
  const inserted: string[] = [];
  const skipped:  string[] = [];

  for (const spFolder of spFolders) {
    const path = `${companyFolder}/TeamFolder/${spFolder.name.trim()}`;

    if (existingPaths.has(path)) {
      skipped.push(spFolder.name);
      continue;
    }

    await prisma.dmsFolder.create({
      data: {
        company_id,
        name:       spFolder.name.trim(),
        path,
        type:       "TEAM",
        parent_id:  null,
        created_by: user_id,
      },
    });

    existingPaths.add(path);
    inserted.push(spFolder.name);
  }

  /* ── 5. Return summary ───────────────────────────────────────────── */
  return NextResponse.json({
    success:  true,
    summary: {
      sharepoint_folders_found: spFolders.length,
      inserted:                 inserted.length,
      skipped:                  skipped.length,
    },
    inserted,
    skipped,
  });
}

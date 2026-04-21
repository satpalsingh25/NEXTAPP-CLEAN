import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ADMIN_ONLY } from "@/lib/auth.server";
import { createFolder } from "@/lib/sharepoint-check";
import { ensureCompanyRootFolder } from "@/lib/dms-company-root";
import { buildFolderPath } from "@/lib/dms-folder-path";
import { logDmsActivity } from "@/lib/dms-activity";

/* Build breadcrumb trail by walking up the parent chain */
async function buildBreadcrumbs(
  folderId: string,
): Promise<{ id: string; name: string }[]> {
  const crumbs: { id: string; name: string }[] = [];
  let currentId: string | null = folderId;
  while (currentId) {
    const folder = await prisma.dmsFolder.findUnique({
      where:  { id: currentId },
      select: { id: true, name: true, parent_id: true },
    });
    if (!folder) break;
    crumbs.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parent_id;
  }
  return crumbs;
}

/* GET /api/dms/folders?parent_id=<uuid>
   Returns { currentFolder, breadcrumbs, folders, files }
   If parent_id is omitted, returns a stub with Root breadcrumb. */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  const { searchParams } = new URL(req.url);
  const parent_id = searchParams.get("parent_id");

  /* ── No parent_id: return Root stub ── */
  if (!parent_id) {
    return NextResponse.json({
      currentFolder: null,
      breadcrumbs:   [{ id: null, name: "Root" }],
      folders:       [],
      files:         [],
    });
  }

  const parent = await prisma.dmsFolder.findUnique({
    where:  { id: parent_id },
    select: { id: true, name: true, path: true, type: true, created_at: true, company_id: true },
  });
  if (!parent)                          return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  if (parent.company_id !== company_id) return NextResponse.json({ error: "Access denied." },   { status: 403 });

  /* ── Build breadcrumbs ── */
  const breadcrumbs = await buildBreadcrumbs(parent_id);

  /* ── Fetch child folders ── */
  let folders;
  if (parent.type === "USER") {
    /* USER folders are personal — return only folders owned by this user */
    folders = await prisma.dmsFolder.findMany({
      where:   { company_id, parent_id, type: "USER", created_by: user_id },
      orderBy: { name: "asc" },
      select:  { id: true, name: true, path: true, type: true, created_at: true },
    });
  } else {
    /* TEAM folders — permission filtering handled client-side / dedicated routes */
    folders = await prisma.dmsFolder.findMany({
      where:   { company_id, parent_id },
      orderBy: { name: "asc" },
      select:  { id: true, name: true, path: true, type: true, created_at: true },
    });
  }

  /* ── Fetch files in this folder (same logic as GET /api/dms/files) ── */
  const files = await prisma.dmsDocument.findMany({
    where:   { company_id, folder_path: parent.path },
    orderBy: { created_at: "desc" },
    select:  { id: true, name: true, file_url: true, uploaded_by: true, created_at: true },
  });

  const currentFolder = {
    id:         parent.id,
    name:       parent.name,
    path:       parent.path,
    type:       parent.type,
    created_at: parent.created_at,
  };

  return NextResponse.json({ currentFolder, breadcrumbs, folders, files });
}

/* POST /api/dms/folders — create a subfolder or a TEAM root folder (admin only) */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { name, parent_id, type } = body ?? {};

  if (!name?.trim()) return NextResponse.json({ error: "name is required." }, { status: 400 });

  /* ── TEAM folder — admin only ─────────────────────────────────────────── */
  if (type === "TEAM") {
    const auth = requireRole(req, ADMIN_ONLY);
    if ("error" in auth) return auth.error;
    const { company_id, user_id } = auth.user;

    const company = await prisma.company.findUnique({
      where:  { id: company_id },
      select: { name: true, company_folder_name: true },
    });
    if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

    const companyFolder =
      company.company_folder_name?.trim() || company.name.replace(/\s+/g, "_");
    const path = buildFolderPath({ type: "TEAM", companyFolderName: companyFolder, folderName: name.trim() });

    /* ── Ensure company root folder exists before creating subfolder ── */
    await ensureCompanyRootFolder(company_id, companyFolder, user_id);

    const existing = await prisma.dmsFolder.findFirst({ where: { company_id, path } });
    if (existing) {
      return NextResponse.json({ error: "A team folder with that name already exists." }, { status: 409 });
    }

    const folder = await prisma.dmsFolder.create({
      data: {
        company_id,
        name:       name.trim(),
        path,
        type:       "TEAM",
        parent_id:  null,
        created_by: user_id,
      },
    });

    /* ── Auto-grant FULL ACCESS to all Admin users in this company ─── */
    const adminUsers = await prisma.user.findMany({
      where:  { company_id, role: "ADMIN" },
      select: { id: true },
    });

    if (adminUsers.length > 0) {
      await prisma.folderPermission.createMany({
        data: adminUsers.map((u) => ({
          folder_id:  folder.id,
          access_type: "USER",
          access_id:   u.id,
          can_read:    true,
          can_upload:  true,
          can_write:   true,
          can_delete:  true,
        })),
        skipDuplicates: true,
      });
    }

    void logDmsActivity({
      company_id, user_id,
      action:      "CREATE_FOLDER",
      entity_type: "folder",
      entity_id:   folder.id,
      entity_name: folder.name,
    });

    return NextResponse.json(folder, { status: 201 });
  }

  /* ── USER subfolder — any authenticated user ──────────────────────────── */
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  /* ── Resolve parent path ────────────────────────────────────────────── */
  let parentPath: string;

  if (parent_id) {
    /* parent_id provided — fetch the parent folder and use its path */
    const parent = await prisma.dmsFolder.findUnique({
      where:  { id: parent_id },
      select: { path: true, company_id: true },
    });
    if (!parent)                          return NextResponse.json({ error: "Parent folder not found." }, { status: 404 });
    if (parent.company_id !== company_id) return NextResponse.json({ error: "Access denied." },           { status: 403 });

    parentPath = parent.path;
  } else {
    /* No parent_id — anchor under the user's root USER folder.
       Base path: Company_Name/Users/{user_name}                 */
    const root = await prisma.dmsFolder.findFirst({
      where:  { company_id, created_by: user_id, type: "USER", parent_id: null },
      select: { path: true },
    });
    if (!root) {
      return NextResponse.json(
        { error: "User root folder not found. Please open My Files first to initialise it." },
        { status: 404 },
      );
    }
    parentPath = root.path;
  }

  /* Full path via buildFolderPath: strips trailing slashes on parentPath,
     appends the folder name with no slug/lowercase conversion.            */
  const folderName = name.trim();
  const folderPath = buildFolderPath({ parentPath, folderName });

  /* Duplicate check */
  const existing = await prisma.dmsFolder.findFirst({ where: { company_id, path: folderPath } });
  if (existing) {
    return NextResponse.json({ error: "A folder with that name already exists here." }, { status: 409 });
  }

  /* Persist to the database first (optimistic — rolled back if SharePoint fails) */
  const folder = await prisma.dmsFolder.create({
    data: {
      company_id,
      name:       folderName,
      path:       folderPath,
      type:       "USER",
      parent_id:  parent_id ?? null,
      created_by: user_id,
    },
  });

  /* ── Create the folder on SharePoint ───────────────────────────────── */
  try {
    await createFolder(company_id, parentPath, folderName);
  } catch (err) {
    /* Roll back the DB record so state stays consistent */
    await prisma.dmsFolder.delete({ where: { id: folder.id } }).catch(() => {});
    const message = err instanceof Error ? err.message : "SharePoint folder creation failed.";
    console.error("[POST /api/dms/folders] SharePoint createFolder failed:", { company_id, folderPath, message });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  void logDmsActivity({
    company_id, user_id,
    action:      "CREATE_FOLDER",
    entity_type: "folder",
    entity_id:   folder.id,
    entity_name: folder.name,
  });

  return NextResponse.json(folder, { status: 201 });
}

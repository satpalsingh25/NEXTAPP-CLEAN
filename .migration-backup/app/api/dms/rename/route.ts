import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import type { AuthUser } from "@/lib/auth.server";
import { checkFolderAccess } from "@/lib/dms-permission";
import { getDriveId, getSharePointToken, checkSharePointConfigured } from "@/lib/sharepoint-check";
import { logDmsActivity } from "@/lib/dms-activity";
import { gateModule } from "@/lib/module-access";

/* Characters forbidden in folder/file names */
const INVALID_NAME_RE = /[/\\?%*:|"<>]/;

/* ------------------------------------------------------------------ */
/* PATCH /api/dms/rename                                               */
/* Body: { id, type: "folder" | "file", new_name }                    */
/* ------------------------------------------------------------------ */
export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "DMS");
  if (gate) return gate;

  const body = await req.json().catch(() => null);
  const { id, type, new_name } = body ?? {};

  if (!id || !type || typeof new_name !== "string") {
    return NextResponse.json({ error: "id, type, and new_name are required." }, { status: 400 });
  }

  const trimmedName = new_name.trim();

  if (!trimmedName) {
    return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
  }
  if (INVALID_NAME_RE.test(trimmedName)) {
    return NextResponse.json(
      { error: 'Name contains invalid characters. Avoid: / \\ ? % * : | " < >' },
      { status: 400 },
    );
  }

  if (type === "folder") return renameFolder(auth.user, id, trimmedName);
  if (type === "file")   return renameFile(auth.user, id, trimmedName);

  return NextResponse.json({ error: 'type must be "folder" or "file".' }, { status: 400 });
}

/* ================================================================== */
/* renameFolder                                                         */
/* ================================================================== */
async function renameFolder(user: AuthUser, id: string, trimmedName: string) {
  const { company_id, user_id } = user;

  const folder = await prisma.dmsFolder.findUnique({ where: { id } });
  if (!folder)                          return NextResponse.json({ error: "Folder not found." },  { status: 404 });
  if (folder.company_id !== company_id) return NextResponse.json({ error: "Access denied." },     { status: 403 });

  /* Same name — nothing to do */
  if (folder.name === trimmedName) return NextResponse.json({ success: true });

  /* ── Permission check ── */
  const isOwner = folder.type === "USER" && folder.created_by === user_id;
  if (!isOwner) {
    const access = await checkFolderAccess(user, id);
    if (!access.can_write) {
      return NextResponse.json(
        { error: "You do not have permission to rename this folder." },
        { status: 403 },
      );
    }
  }

  /* ── Build new path (replace last segment) ── */
  const oldPath  = folder.path;
  const segments = oldPath.split("/");
  segments[segments.length - 1] = trimmedName;
  const newPath = segments.join("/");

  /* ── Duplicate name check ── */
  const existing = await prisma.dmsFolder.findFirst({
    where: { company_id, path: newPath, id: { not: id } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A folder with that name already exists here." },
      { status: 409 },
    );
  }

  /* ── SharePoint rename (best-effort) ── */
  const spConfigured = await checkSharePointConfigured(company_id);
  if (spConfigured) {
    try {
      const [drive_id, accessToken] = await Promise.all([
        getDriveId(company_id),
        getSharePointToken(company_id),
      ]);

      /* Graph API: PATCH the item located by its drive path */
      const spPath    = oldPath.replace(/^\/+|\/+$/g, "");
      const renameUrl = `https://graph.microsoft.com/v1.0/drives/${drive_id}/root:/${spPath}`;

      const spRes = await fetch(renameUrl, {
        method:  "PATCH",
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!spRes.ok) {
        const err = await spRes.json().catch(() => ({})) as { error?: { message?: string } };
        console.error(
          "[dms/rename] SharePoint folder PATCH failed:",
          err?.error?.message ?? spRes.status,
        );
        /* Non-fatal — DB rename continues */
      }
    } catch (e) {
      console.error("[dms/rename] SharePoint folder error:", (e as Error).message);
    }
  }

  /* ── DB: rename folder itself ── */
  await prisma.dmsFolder.update({
    where: { id },
    data:  { name: trimmedName, path: newPath },
  });

  /* ── DB: cascade path update to all descendant folders ── */
  const childFolders = await prisma.dmsFolder.findMany({
    where:  { company_id, path: { startsWith: oldPath + "/" } },
    select: { id: true, path: true },
  });
  for (const child of childFolders) {
    await prisma.dmsFolder.update({
      where: { id: child.id },
      data:  { path: newPath + child.path.slice(oldPath.length) },
    });
  }

  /* ── DB: cascade folder_path update to documents directly inside ── */
  await prisma.dmsDocument.updateMany({
    where: { company_id, folder_path: oldPath },
    data:  { folder_path: newPath },
  });

  /* ── DB: cascade folder_path update to documents in sub-folders ── */
  const subDocs = await prisma.dmsDocument.findMany({
    where:  { company_id, folder_path: { startsWith: oldPath + "/" } },
    select: { id: true, folder_path: true },
  });
  for (const doc of subDocs) {
    await prisma.dmsDocument.update({
      where: { id: doc.id },
      data:  { folder_path: newPath + doc.folder_path.slice(oldPath.length) },
    });
  }

  void logDmsActivity({
    company_id, user_id,
    action:      "RENAME",
    entity_type: "folder",
    entity_id:   id,
    entity_name: trimmedName,
    details:     { old_name: folder.name, new_name: trimmedName },
  });

  return NextResponse.json({ success: true });
}

/* ================================================================== */
/* renameFile                                                           */
/* ================================================================== */
async function renameFile(user: AuthUser, id: string, trimmedName: string) {
  const { company_id, user_id } = user;

  const doc = await prisma.dmsDocument.findUnique({ where: { id } });
  if (!doc)                          return NextResponse.json({ error: "File not found." },  { status: 404 });
  if (doc.company_id !== company_id) return NextResponse.json({ error: "Access denied." },   { status: 403 });

  /* Same name — nothing to do */
  if (doc.name === trimmedName) return NextResponse.json({ success: true });

  /* ── Permission check via parent folder ── */
  const parentFolder = await prisma.dmsFolder.findFirst({
    where:  { company_id, path: doc.folder_path },
    select: { id: true, type: true, created_by: true },
  });

  if (parentFolder) {
    const isOwner = parentFolder.type === "USER" && parentFolder.created_by === user_id;
    if (!isOwner) {
      const access = await checkFolderAccess(user, parentFolder.id);
      if (!access.can_write) {
        return NextResponse.json(
          { error: "You do not have permission to rename files in this folder." },
          { status: 403 },
        );
      }
    }
  }

  /* ── SharePoint rename (best-effort) ── */
  const spConfigured = await checkSharePointConfigured(company_id);
  if (spConfigured && doc.sharepoint_item_id && doc.drive_id) {
    try {
      const accessToken = await getSharePointToken(company_id);
      const renameUrl   =
        `https://graph.microsoft.com/v1.0/drives/${doc.drive_id}/items/${doc.sharepoint_item_id}`;

      const spRes = await fetch(renameUrl, {
        method:  "PATCH",
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!spRes.ok) {
        const err = await spRes.json().catch(() => ({})) as { error?: { message?: string } };
        console.error(
          "[dms/rename] SharePoint file PATCH failed:",
          err?.error?.message ?? spRes.status,
        );
      }
    } catch (e) {
      console.error("[dms/rename] SharePoint file error:", (e as Error).message);
    }
  }

  /* ── DB: rename the document ── */
  await prisma.dmsDocument.update({
    where: { id },
    data:  { name: trimmedName },
  });

  void logDmsActivity({
    company_id, user_id,
    action:      "RENAME",
    entity_type: "file",
    entity_id:   id,
    entity_name: trimmedName,
    details:     { old_name: doc.name, new_name: trimmedName },
  });

  return NextResponse.json({ success: true });
}

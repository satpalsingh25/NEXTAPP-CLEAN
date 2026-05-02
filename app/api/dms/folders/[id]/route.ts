import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import { checkFolderAccess } from "@/lib/dms-permission";
import { logDmsActivity } from "@/lib/dms-activity";
import { gateModule } from "@/lib/module-access";
import { logAudit } from "@/lib/audit-log";

type Params = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/* PATCH /api/dms/folders/:id  — rename folder                        */
/* ------------------------------------------------------------------ */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "DMS");
  if (gate) return gate;
  const { company_id } = auth.user;
  const { id } = await params;

  const folder = await prisma.dmsFolder.findUnique({ where: { id } });
  if (!folder)                          return NextResponse.json({ error: "Folder not found." },  { status: 404 });
  if (folder.company_id !== company_id) return NextResponse.json({ error: "Access denied." },     { status: 403 });

  const isOwnerUserFolder =
    folder.type === "USER" && folder.created_by === auth.user.user_id;

  if (!isOwnerUserFolder) {
    const access = await checkFolderAccess(auth.user, id);
    if (!access.can_write) {
      return NextResponse.json({ error: "You do not have permission to rename this folder." }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => null);
  const name  = (body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });

  const updated = await prisma.dmsFolder.update({
    where: { id },
    data:  { name },
  });

  void logAudit({ company_id, user_id: auth.user.user_id, action: "RENAME", module: "DMS", entity_type: "folder", entity_id: id, description: `Renamed to ${name}` });

  return NextResponse.json(updated);
}

/* ------------------------------------------------------------------ */
/* DELETE /api/dms/folders/:id  — delete folder (and its documents)   */
/* ------------------------------------------------------------------ */
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "DMS");
  if (gate) return gate;
  const { company_id } = auth.user;
  const { id } = await params;

  const folder = await prisma.dmsFolder.findUnique({ where: { id } });
  if (!folder)                          return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  if (folder.company_id !== company_id) return NextResponse.json({ error: "Access denied." },    { status: 403 });

  const isOwnerUserFolderDel =
    folder.type === "USER" && folder.created_by === auth.user.user_id;

  if (!isOwnerUserFolderDel) {
    const access = await checkFolderAccess(auth.user, id);
    if (!access.can_delete) {
      return NextResponse.json({ error: "You do not have permission to delete this folder." }, { status: 403 });
    }
  }

  /* Guard: refuse if subfolders exist */
  const childCount = await prisma.dmsFolder.count({ where: { parent_id: id } });
  if (childCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a folder that contains subfolders. Remove them first." },
      { status: 409 },
    );
  }

  /* Delete documents whose folder_path matches this folder's path */
  await prisma.dmsDocument.deleteMany({ where: { company_id, folder_path: folder.path } });

  /* Delete the folder record */
  await prisma.dmsFolder.delete({ where: { id } });

  void logDmsActivity({
    company_id, user_id: auth.user.user_id,
    action:      "DELETE",
    entity_type: "folder",
    entity_id:   id,
    entity_name: folder.name,
  });
  void logAudit({ company_id, user_id: auth.user.user_id, action: "DELETE_FOLDER", module: "DMS", entity_type: "folder", entity_id: id, description: `Deleted folder ${folder.name}` });

  return NextResponse.json({ success: true });
}

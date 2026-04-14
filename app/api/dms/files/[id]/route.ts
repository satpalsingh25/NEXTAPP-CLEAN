import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import { checkFolderAccess } from "@/lib/dms-permission";

type Params = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/* DELETE /api/dms/files/:id  — delete a document record              */
/* ------------------------------------------------------------------ */
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;
  const { id } = await params;

  const doc = await prisma.dmsDocument.findUnique({ where: { id } });
  if (!doc)                          return NextResponse.json({ error: "File not found." },  { status: 404 });
  if (doc.company_id !== company_id) return NextResponse.json({ error: "Access denied." },   { status: 403 });

  /* Resolve the parent folder by path to check delete permission */
  const parentFolder = await prisma.dmsFolder.findFirst({
    where:  { company_id, path: doc.folder_path },
    select: { id: true, type: true, created_by: true },
  });

  if (parentFolder) {
    const isOwnerUserFolder =
      parentFolder.type === "USER" && parentFolder.created_by === auth.user.user_id;

    if (!isOwnerUserFolder) {
      const access = await checkFolderAccess(auth.user, parentFolder.id);
      if (!access.can_delete) {
        return NextResponse.json(
          { error: "You do not have permission to delete files in this folder." },
          { status: 403 },
        );
      }
    }
  }

  await prisma.dmsDocument.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

/* ------------------------------------------------------------------ */
/* PATCH /api/dms/files/:id  — rename a document                      */
/* ------------------------------------------------------------------ */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;
  const { id } = await params;

  const doc = await prisma.dmsDocument.findUnique({ where: { id } });
  if (!doc)                          return NextResponse.json({ error: "File not found." },  { status: 404 });
  if (doc.company_id !== company_id) return NextResponse.json({ error: "Access denied." },   { status: 403 });

  const parentFolderRen = await prisma.dmsFolder.findFirst({
    where:  { company_id, path: doc.folder_path },
    select: { id: true, type: true, created_by: true },
  });

  if (parentFolderRen) {
    const isOwnerUserFolder =
      parentFolderRen.type === "USER" && parentFolderRen.created_by === auth.user.user_id;

    if (!isOwnerUserFolder) {
      const access = await checkFolderAccess(auth.user, parentFolderRen.id);
      if (!access.can_write) {
        return NextResponse.json(
          { error: "You do not have permission to rename files in this folder." },
          { status: 403 },
        );
      }
    }
  }

  const body = await req.json().catch(() => null);
  const name  = (body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });

  const updated = await prisma.dmsDocument.update({
    where: { id },
    data:  { name },
  });

  return NextResponse.json(updated);
}

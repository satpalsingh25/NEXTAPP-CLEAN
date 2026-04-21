import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import { gateModule } from "@/lib/module-access";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "DMS");
  if (gate) return gate;
  const { company_id } = auth.user;

  const { searchParams } = new URL(req.url);
  const folder_id = searchParams.get("folder_id");

  if (!folder_id) {
    return NextResponse.json({ error: "folder_id is required." }, { status: 400 });
  }

  const folder = await prisma.dmsFolder.findUnique({
    where:  { id: folder_id },
    select: { path: true, company_id: true },
  });

  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  if (folder.company_id !== company_id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const files = await prisma.dmsDocument.findMany({
    where: {
      company_id,
      folder_path: folder.path,
    },
    select: {
      id:          true,
      name:        true,
      file_url:    true,
      uploaded_by: true,
      created_at:  true,
    },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json(files);
}

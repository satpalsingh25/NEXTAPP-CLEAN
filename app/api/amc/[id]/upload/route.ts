import { NextRequest, NextResponse } from "next/server";
import { prisma }                   from "@/lib/prisma";
import { requireAuth }              from "@/lib/auth.server";
import { uploadFile }               from "@/lib/storage";

/* ------------------------------------------------------------------ */
/* POST /api/amc/[id]/upload                                            */
/* Content-Type: multipart/form-data                                   */
/* Fields: file (one or many)                                          */
/*                                                                      */
/* Uploads evidence files for an AMC record via the central storage   */
/* service. Stores a Document row per file under module=AMC,          */
/* record_id=<amc id>.                                                  */
/*                                                                      */
/* Does NOT touch DMS folders or DMS permissions.                      */
/* ------------------------------------------------------------------ */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  const { id: amc_id } = await params;
  if (!amc_id) {
    return NextResponse.json({ error: "amc_id is required." }, { status: 400 });
  }

  /* 1. Verify AMC record exists & belongs to the user's tenant ----- */
  const record = await prisma.aMC.findUnique({
    where:  { id: amc_id },
    select: { id: true, company_id: true },
  });
  if (!record) {
    return NextResponse.json({ error: "AMC record not found." }, { status: 404 });
  }
  if (record.company_id !== company_id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  /* 2. Parse multipart body --------------------------------------- */
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data." }, { status: 400 });
  }

  const files = form.getAll("file") as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: "At least one file is required." }, { status: 400 });
  }

  /* 3. Upload each file via storage service & persist metadata ----- */
  const uploaded: { id: string; file_path: string }[] = [];

  for (const file of files) {
    let result;
    try {
      result = await uploadFile({
        file,
        fileName:   file.name,
        mimeType:   file.type || "application/octet-stream",
        company_id,
        user_id,
        module:     "AMC",
        record_id:  amc_id,
      });
    } catch (e: unknown) {
      return NextResponse.json(
        { error: `Upload failed for "${file.name}": ${(e as Error).message}` },
        { status: 502 },
      );
    }

    const doc = await prisma.document.create({
      data: {
        company_id,
        module:      "AMC",
        record_id:   amc_id,
        file_path:   result.path,
        uploaded_by: user_id,
      },
      select: { id: true, file_path: true },
    });

    uploaded.push(doc);
  }

  /* 4. Done -------------------------------------------------------- */
  return NextResponse.json({ success: true, uploaded });
}

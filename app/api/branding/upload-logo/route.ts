import { NextRequest, NextResponse } from "next/server";
import { prisma }                   from "@/lib/prisma";
import { uploadFile }               from "@/lib/storage";
import { requireRole }              from "@/lib/auth.server";
import { extractPrimaryColorFromBuffer } from "@/lib/color-extract";

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;

/* ------------------------------------------------------------------ */
/* POST /api/branding/upload-logo                                       */
/*                                                                      */
/* Multipart form upload — field name: "file".                          */
/* Streams to SharePoint via the central storage service under          */
/*   /Company/{co_slug}/Branding/{filename}                             */
/* then upserts the resulting path onto Branding.logo_url.              */
/* SUPER_ADMIN + ADMIN only.                                           */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
  if ("error" in auth) return auth.error;

  const company_id = auth.user.company_id;
  const user_id    = auth.user.user_id;
  if (!company_id) {
    return NextResponse.json({ error: "No company context." }, { status: 400 });
  }

  /* ── Parse multipart ───────────────────────────────────────────── */
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "File required." }, { status: 400 });
  }

  /* ── Validation ────────────────────────────────────────────────── */
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, or WebP images are allowed." },
      { status: 400 },
    );
  }

  /* ── Upload via central storage service ────────────────────────── */
  let result;
  try {
    result = await uploadFile({
      file,
      fileName:    file.name,
      mimeType:    file.type,
      company_id,
      user_id,
      module:      "DMS",
      parent_path: "/Branding",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  /* ── Extract dominant color (non-blocking, always falls back) ──── */
  let primaryColor: string | null = null;
  try {
    const buf    = Buffer.from(await file.arrayBuffer());
    primaryColor = await extractPrimaryColorFromBuffer(buf);
  } catch {
    // Swallow — color is a best-effort enhancement, never blocks upload.
    primaryColor = null;
  }

  /* ── Persist on Branding row ───────────────────────────────────── */
  const branding = await prisma.branding.upsert({
    where:  { company_id },
    update: {
      logo_url: result.path,
      ...(primaryColor ? { primary_color: primaryColor, secondary_color: primaryColor } : {}),
    },
    create: {
      company_id,
      logo_url:        result.path,
      primary_color:   primaryColor,
      secondary_color: primaryColor,
    },
  });

  return NextResponse.json({
    success:         true,
    logo_url:        branding.logo_url,
    primary_color:   branding.primary_color,
    secondary_color: branding.secondary_color,
  });
}

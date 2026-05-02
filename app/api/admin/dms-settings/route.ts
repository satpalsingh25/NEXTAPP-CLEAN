import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";

const DEFAULTS = {
  max_file_size_mb:           10,
  max_files_per_upload:       20,
  allow_user_folder_creation: false,
} as const;

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  let settings = await prisma.dmsSettings.findUnique({ where: { company_id } });

  if (!settings) {
    settings = await prisma.dmsSettings.create({
      data: { company_id, ...DEFAULTS },
    });
  }

  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  const body = await req.json();
  const { max_file_size_mb, max_files_per_upload, allow_user_folder_creation } = body as {
    max_file_size_mb:           number;
    max_files_per_upload:       number;
    allow_user_folder_creation: boolean;
  };

  if (
    typeof max_file_size_mb      !== "number" ||
    typeof max_files_per_upload  !== "number" ||
    typeof allow_user_folder_creation !== "boolean"
  ) {
    return NextResponse.json(
      { error: "max_file_size_mb (number), max_files_per_upload (number), and allow_user_folder_creation (boolean) are required." },
      { status: 400 },
    );
  }

  await prisma.dmsSettings.upsert({
    where:  { company_id },
    update: { max_file_size_mb, max_files_per_upload, allow_user_folder_creation },
    create: { company_id, max_file_size_mb, max_files_per_upload, allow_user_folder_creation },
  });

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import { ensureCompanyRootFolder } from "@/lib/dms-company-root";
import { buildFolderPath } from "@/lib/dms-folder-path";

/** Replace spaces with _ and strip anything that isn't a word char or hyphen. */
function sanitizeName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "");
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  /* 1. Reuse existing folder if one already exists (never move/rename) */
  const existing = await prisma.dmsFolder.findFirst({
    where: { company_id, created_by: user_id, type: "USER", parent_id: null },
  });
  if (existing) return NextResponse.json(existing);

  /* 2. Fetch user + company in parallel to build the folder path ------ */
  const [user, company] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: user_id },
      select: { name: true, email: true },
    }),
    prisma.company.findUnique({
      where:  { id: company_id },
      select: { name: true, company_folder_name: true },
    }),
  ]);

  /* 3. Derive display name: prefer user.name, fall back to email prefix */
  const rawDisplayName =
    (user?.name && user.name.trim()) ||
    (user?.email?.split("@")[0] ?? user_id);

  const sanitizedUser    = sanitizeName(rawDisplayName) || user_id;
  const sanitizedCompany =
    company?.company_folder_name?.trim() ||
    (company?.name ? company.name.replace(/\s+/g, "_") : "Company");

  /* 3a. Ensure company root folder exists before creating user folder */
  await ensureCompanyRootFolder(company_id, sanitizedCompany, user_id);

  /* 4. Path: {Company}/Users/{sanitized_user_name} */
  const path = buildFolderPath({ type: "USER", companyFolderName: sanitizedCompany, folderName: sanitizedUser });

  /* 5. Create the folder -------------------------------------------- */
  const folder = await prisma.dmsFolder.create({
    data: {
      company_id,
      name:       sanitizedUser,
      path,
      type:       "USER",
      parent_id:  null,
      created_by: user_id,
    },
  });

  return NextResponse.json(folder);
}

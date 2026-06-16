import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/auth.server";

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user_id: userId, company_id: companyId, role } = auth.user;

  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const relativeDir = `uploads/${companyId}/branding`;
    const uploadDir = path.join(process.cwd(), "public", relativeDir);

    await mkdir(uploadDir, { recursive: true });

    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const filePath = path.join(uploadDir, filename);
    const logoUrl = `/${relativeDir}/${filename}`;

    await writeFile(filePath, buffer);

    const oldData = await prisma.company.findUnique({ where: { id: companyId } });
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { logo_url: logoUrl },
    });

    await prisma.auditLog.create({
      data: {
        company_id:  companyId,
        user_id:     userId,
        action:      "UPDATE_LOGO",
        module:      "ADMIN",
        entity_type: "company",
        entity_id:   companyId,
        description: `Updated logo for company ${companyId}`,
      },
    });

    return NextResponse.json({ logo_url: logoUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

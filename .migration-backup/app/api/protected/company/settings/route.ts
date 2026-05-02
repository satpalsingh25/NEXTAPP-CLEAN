import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id: companyId } = auth.user;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      custom_display_name: true,
      logo_url: true,
      primary_color: true,
      secondary_color: true,
    },
  });

  return NextResponse.json(company);
}

export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user_id: userId, company_id: companyId, role } = auth.user;

  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const oldData = await prisma.company.findUnique({ where: { id: companyId } });

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      custom_display_name: body.custom_display_name,
      primary_color: body.primary_color,
      secondary_color: body.secondary_color,
    },
  });

  await prisma.auditLog.create({
    data: {
      company_id: companyId,
      user_id: userId,
      action_type: "UPDATE_BRANDING",
      module: "COMPLIANCE",
      record_id: companyId,
      old_value: oldData as any,
      new_value: updated as any,
    },
  });

  return NextResponse.json(updated);
}

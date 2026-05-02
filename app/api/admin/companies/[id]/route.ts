import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth.server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ["SUPER_ADMIN"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  try {
    const body = await req.json();
    const company = await prisma.company.update({
      where: { id },
      data: { is_active: body.is_active },
      include: {
        country: { select: { id: true, name: true } },
        _count: { select: { users: true, compliances: true, departments: true } },
      },
    });
    return NextResponse.json(company);
  } catch {
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ["SUPER_ADMIN"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  try {
    const userCount = await prisma.user.count({ where: { company_id: id } });
    if (userCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${userCount} user${userCount !== 1 ? "s are" : " is"} linked to this company` },
        { status: 409 }
      );
    }

    const complianceCount = await prisma.compliance.count({ where: { company_id: id } });
    if (complianceCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${complianceCount} compliance record${complianceCount !== 1 ? "s are" : " is"} linked to this company` },
        { status: 409 }
      );
    }

    const amcCount = await prisma.aMC.count({ where: { company_id: id } });
    if (amcCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${amcCount} AMC record${amcCount !== 1 ? "s are" : " is"} linked to this company` },
        { status: 409 }
      );
    }

    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete company" }, { status: 500 });
  }
}

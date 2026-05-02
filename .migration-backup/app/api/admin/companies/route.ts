import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, ADMIN_ONLY } from "@/lib/auth.server";
import { seedCompanyStatuses } from "@/lib/seedStatuses";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id, role } = auth.user;

  try {
    const where = role === "SUPER_ADMIN" ? {} : { id: company_id };
    const companies = await prisma.company.findMany({
      where,
      include: {
        country: { select: { id: true, name: true } },
        _count: { select: { users: true, compliances: true, departments: true } },
      },
      orderBy: { created_at: "asc" },
    });
    return NextResponse.json(companies);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load companies" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ["SUPER_ADMIN"]);
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const trimmedName = body.name.trim();
    const company = await prisma.company.create({
      data: {
        name:                trimmedName,
        country_id:          body.country_id || null,
        company_folder_name: trimmedName.replace(/\s+/g, "_"),
      },
      include: {
        country: { select: { id: true, name: true } },
        _count: { select: { users: true, compliances: true, departments: true } },
      },
    });

    await seedCompanyStatuses(company.id).catch(() => {});

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = requireRole(req, ["SUPER_ADMIN"]);
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const company = await prisma.company.update({
      where: { id: body.id },
      data: {
        ...(body.name       !== undefined ? {
          name:                body.name.trim(),
          company_folder_name: body.name.trim().replace(/\s+/g, "_"),
        } : {}),
        ...(body.country_id !== undefined ? { country_id: body.country_id || null } : {}),
      },
      include: {
        country: { select: { id: true, name: true } },
        _count: { select: { users: true, compliances: true, departments: true } },
      },
    });
    return NextResponse.json(company);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 });
  }
}

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, ADMIN_ONLY } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id, role } = auth.user;

  try {
    const url = new URL(req.url);
    const filterDept    = url.searchParams.get("department_id");
    const filterCompany = url.searchParams.get("company_id");

    let where: Record<string, unknown> =
      role === "SUPER_ADMIN" ? {} : { company_id };

    if (filterDept)    where = { ...where, department_id: filterDept };
    if (filterCompany) where = { ...where, company_id: filterCompany };

    const data = await prisma.businessFunction.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        company:    { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        _count:     { select: { users: true } },
      },
    });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  try {
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const data = await prisma.businessFunction.create({
      data: {
        name:          body.name.trim(),
        company_id:    body.company_id    || company_id,
        department_id: body.department_id || null,
      },
      include: {
        company:    { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const data = await prisma.businessFunction.update({
      where: { id: body.id },
      data: {
        ...(body.name          !== undefined ? { name: body.name.trim() }                   : {}),
        ...(body.company_id    !== undefined ? { company_id: body.company_id || null }       : {}),
        ...(body.department_id !== undefined ? { department_id: body.department_id || null } : {}),
      },
      include: {
        company:    { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await req.json();
    await prisma.businessFunction.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

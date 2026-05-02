import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, ADMIN_ONLY } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id, role } = auth.user;

  try {
    const url = new URL(req.url);
    const filterCompany = url.searchParams.get("company_id");

    const where: Record<string, unknown> =
      role === "SUPER_ADMIN"
        ? filterCompany ? { company_id: filterCompany } : {}
        : { company_id };

    const data = await prisma.department.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { functions: true, users: true } },
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
    const data = await prisma.department.create({
      data: {
        name: body.name.trim(),
        company_id: body.company_id || company_id,
      },
      include: { company: { select: { id: true, name: true } } },
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
    const data = await prisma.department.update({
      where: { id: body.id },
      data: {
        ...(body.name       !== undefined ? { name: body.name.trim() }             : {}),
        ...(body.company_id !== undefined ? { company_id: body.company_id || null } : {}),
      },
      include: { company: { select: { id: true, name: true } } },
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
    await prisma.department.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

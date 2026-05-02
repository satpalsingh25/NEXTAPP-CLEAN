import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id, role } = auth.user;

  try {
    const where = role === "SUPER_ADMIN" ? {} : { company_id };

    const templates = await prisma.complianceTemplate.findMany({
      where,
      select: { id: true, title: true },
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  try {
    const body = await req.json();

    const template = await prisma.complianceTemplate.create({
      data: {
        company_id,
        title: body.name,
        frequency: "MONTHLY",
      },
    });

    return NextResponse.json({ id: template.id, title: template.title });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}

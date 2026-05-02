import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY, MANAGER_PLUS } from "@/lib/auth.server";
import { gateModule } from "@/lib/module-access";

export async function GET(req: NextRequest) {
  const auth = requireRole(req, MANAGER_PLUS);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "AMC");
  if (gate) return gate;
  const { company_id, role } = auth.user;

  try {
    const where = role === "SUPER_ADMIN" ? {} : { company_id };

    const templates = await prisma.aMCTemplate.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        frequency: true,
        approval_levels: true,
        company_id: true,
        created_at: true,
      },
    });

    return NextResponse.json(templates);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "AMC");
  if (gate) return gate;
  const { company_id } = auth.user;

  try {
    const body = await req.json();
    const { name, frequency, approval_levels } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!frequency || typeof frequency !== "string") {
      return NextResponse.json({ error: "frequency is required" }, { status: 400 });
    }
    const levels = Number(approval_levels);
    if (!levels || levels < 1) {
      return NextResponse.json({ error: "approval_levels must be at least 1" }, { status: 400 });
    }

    const template = await prisma.aMCTemplate.create({
      data: {
        name: name.trim(),
        frequency,
        approval_levels: levels,
        company_id,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

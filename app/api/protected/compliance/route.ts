import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import { gateModule } from "@/lib/module-access";

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "COMPLIANCE");
  if (gate) return gate;
  const { user_id: userId, company_id: companyId } = auth.user;

  try {
    const body = await req.json();
    const { template_id, due_date, status_id } = body;

    const compliance = await prisma.compliance.create({
      data: {
        company_id: companyId,
        template_id,
        due_date: new Date(due_date),
        status_id,
        submitted_by: userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        company_id:  companyId,
        user_id:     userId,
        action:      "CREATE",
        module:      "COMPLIANCE",
        entity_type: "compliance",
        entity_id:   compliance.id,
        description: `Created compliance record`,
      },
    });

    return NextResponse.json(compliance, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "COMPLIANCE");
  if (gate) return gate;
  const { company_id: companyId } = auth.user;

  const compliances = await prisma.compliance.findMany({
    where: { company_id: companyId },
    include: {
      template: true,
    },
  });

  return NextResponse.json(compliances);
}

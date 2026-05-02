import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, SUBMIT_ROLES } from "@/lib/auth.server";
import { gateModule } from "@/lib/module-access";

export async function POST(req: NextRequest) {
  const auth = requireRole(req, SUBMIT_ROLES);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "COMPLIANCE");
  if (gate) return gate;

  const { company_id } = auth.user;

  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const record = await prisma.compliance.findFirst({ where: { id, company_id } });
    if (!record) {
      console.warn("[security] compliance submit: record not found or cross-tenant attempt:", auth.user.user_id, id);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const submittedStatus = await prisma.statusMaster.findFirst({
      where: { name: "SUBMITTED", module: "COMPLIANCE" },
    });

    if (!submittedStatus) {
      return NextResponse.json({ error: "Status not found" }, { status: 500 });
    }

    const updated = await prisma.compliance.update({
      where: { id },
      data: {
        status_id: submittedStatus.id,
        current_approval_level: 1,
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("Submit Error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

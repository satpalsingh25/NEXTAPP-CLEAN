import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import { gateModule } from "@/lib/module-access";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "COMPLIANCE");
  if (gate) return gate;
  const { user_id: userId, company_id: companyId } = auth.user;
  const { id } = await context.params;

  try {
    const body = await req.json();
    const { status_id } = body;

    const existing = await prisma.compliance.findFirst({
      where: { id, company_id: companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.compliance.update({
      where: { id },
      data: { status_id },
    });

    await prisma.auditLog.create({
      data: {
        company_id: companyId,
        user_id: userId,
        action_type: "UPDATE_STATUS",
        module: "COMPLIANCE",
        record_id: id,
        old_value: existing as any,
        new_value: updated as any,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

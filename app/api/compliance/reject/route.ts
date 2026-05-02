import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, APPROVER_PLUS } from "@/lib/auth.server";
import { checkCompanyAccess } from "@/lib/permission";
import { gateModule } from "@/lib/module-access";

export async function POST(req: NextRequest) {
  const auth = requireRole(req, APPROVER_PLUS);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "COMPLIANCE");
  if (gate) return gate;

  const { role } = auth.user;
  if (role !== "APPROVER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const record = await prisma.compliance.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json({ error: "Compliance not found" }, { status: 404 });
    }
    try {
      checkCompanyAccess(auth.user, record.company_id);
    } catch {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const rejectedStatus = await prisma.statusMaster.findFirst({
      where: { name: "REJECTED", module: "COMPLIANCE" },
    });

    if (!rejectedStatus) {
      return NextResponse.json({ error: "Rejected status not found" }, { status: 500 });
    }

    const updated = await prisma.compliance.update({
      where: { id },
      data: {
        status_id: rejectedStatus.id,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Reject Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

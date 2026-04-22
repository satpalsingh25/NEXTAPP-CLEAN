import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, APPROVER_PLUS } from "@/lib/auth.server";
import { checkCompanyAccess } from "@/lib/permission";
import { gateModule } from "@/lib/module-access";

const MAX_LEVEL = 3;

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

    const compliance = await prisma.compliance.findUnique({ where: { id } });

    if (!compliance) {
      return NextResponse.json({ error: "Compliance not found" }, { status: 404 });
    }

    try {
      checkCompanyAccess(auth.user, compliance.company_id);
    } catch {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const currentLevel = compliance.current_approval_level;

    const [approvedStatus, submittedStatus] = await Promise.all([
      prisma.statusMaster.findFirst({ where: { name: "APPROVED", module: "COMPLIANCE" } }),
      prisma.statusMaster.findFirst({ where: { name: "SUBMITTED", module: "COMPLIANCE" } }),
    ]);

    if (!approvedStatus || !submittedStatus) {
      return NextResponse.json({ error: "Required statuses not found" }, { status: 500 });
    }

    const updated = await prisma.compliance.update({
      where: { id },
      data: {
        current_approval_level: currentLevel + 1,
        status_id:
          currentLevel + 1 >= MAX_LEVEL
            ? approvedStatus.id
            : submittedStatus.id,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Approve Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

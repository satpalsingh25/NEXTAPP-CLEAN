import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user_id, company_id, role } = auth.user;

  const now = new Date();

  function makeWhere(base: Record<string, unknown>) {
    if (role === "SUPER_ADMIN") return {};
    if (role === "USER" || role === "CEO")
      return { company_id, assigned_user_id: user_id };
    if (role === "APPROVER" || role === "CHECKER")
      return { company_id, ...base };
    return { company_id };
  }

  const complianceWhere = makeWhere({
    approval_levels: { some: { approver_id: user_id } },
  });
  const amcWhere = makeWhere({
    approval_levels: { some: { approver_id: user_id } },
  });

  try {
    const [
      cPending, cSubmitted, cApproved, cRejected, cOverdue,
      aPending, aSubmitted, aApproved, aRejected, aOverdue,
    ] = await Promise.all([
      prisma.compliance.count({ where: { ...complianceWhere, status: { in: ["DRAFT", "PENDING"] } } }),
      prisma.compliance.count({ where: { ...complianceWhere, status: "SUBMITTED" } }),
      prisma.compliance.count({ where: { ...complianceWhere, status: "APPROVED" } }),
      prisma.compliance.count({ where: { ...complianceWhere, status: "REJECTED" } }),
      prisma.compliance.count({ where: { ...complianceWhere, status: { not: "APPROVED" }, due_date: { lt: now } } }),

      prisma.aMC.count({ where: { ...amcWhere, status: { in: ["DRAFT", "PENDING"] } } }),
      prisma.aMC.count({ where: { ...amcWhere, status: "SUBMITTED" } }),
      prisma.aMC.count({ where: { ...amcWhere, status: "APPROVED" } }),
      prisma.aMC.count({ where: { ...amcWhere, status: "REJECTED" } }),
      prisma.aMC.count({ where: { ...amcWhere, status: { not: "APPROVED" }, due_date: { lt: now } } }),
    ]);

    return NextResponse.json({
      compliance: {
        pending:   cPending,
        submitted: cSubmitted,
        approved:  cApproved,
        rejected:  cRejected,
        overdue:   cOverdue,
      },
      amc: {
        pending:   aPending,
        submitted: aSubmitted,
        approved:  aApproved,
        rejected:  aRejected,
        overdue:   aOverdue,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

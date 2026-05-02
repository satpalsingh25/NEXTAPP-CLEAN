import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, APPROVER_PLUS } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireRole(req, APPROVER_PLUS);
  if ("error" in auth) return auth.error;
  const { user_id, company_id, role } = auth.user;

  try {
    const [complianceMatrix, amcMatrix] = await Promise.all([
      prisma.complianceApprovalMatrix.findMany({
        where: { approver_id: user_id },
        select: { template_id: true, level: true },
      }),
      prisma.aMCApprovalMatrix.findMany({
        where: { approver_id: user_id },
        select: { template_id: true, level: true },
      }),
    ]);

    const complianceAssigned = new Set(complianceMatrix.map((m) => `${m.template_id}:${m.level}`));
    const amcAssigned = new Set(amcMatrix.map((m) => `${m.template_id}:${m.level}`));

    const companyFilter = role === "SUPER_ADMIN" ? {} : { company_id };

    const [compRecords, amcRecords] = await Promise.all([
      prisma.compliance.findMany({
        where: { status: "SUBMITTED", ...companyFilter },
        include: { template: { select: { id: true, title: true, approval_levels: true } } },
      }),
      prisma.aMC.findMany({
        where: { status: "SUBMITTED", ...companyFilter },
        include: { amcTemplate: { select: { id: true, name: true, approval_levels: true } } },
      }),
    ]);

    const now = new Date();

    const compliance = compRecords.map((r) => ({
      id: r.id,
      module: "COMPLIANCE",
      name: r.name || r.template?.title || "—",
      template_name: r.template?.title ?? null,
      due_date: r.due_date,
      is_overdue: r.due_date < now,
      current_level: r.current_level,
      total_levels: r.template?.approval_levels ?? 1,
      is_assigned: complianceAssigned.has(`${r.template_id}:${r.current_level}`),
    }));

    const amc = amcRecords.map((r) => ({
      id: r.id,
      module: "AMC",
      name: r.name || r.amcTemplate?.name || "—",
      template_name: r.amcTemplate?.name ?? null,
      due_date: r.expiry_date ?? null,
      is_overdue: r.expiry_date ? r.expiry_date < now : false,
      current_level: r.current_level,
      total_levels: r.amcTemplate?.approval_levels ?? 1,
      is_assigned: amcAssigned.has(`${r.amc_template_id}:${r.current_level}`),
    }));

    return NextResponse.json({
      compliance,
      amc,
      totals: {
        compliance_assigned: compliance.filter((r) => r.is_assigned).length,
        amc_assigned: amc.filter((r) => r.is_assigned).length,
        compliance_all: compliance.length,
        amc_all: amc.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id: companyId } = auth.user;

  const today = new Date();

  try {
    const stats = await prisma.compliance.groupBy({
      by: ["status_id"],
      where: { company_id: companyId },
      _count: true,
    });

    const total = await prisma.compliance.count({
      where: { company_id: companyId },
    });

    const overdue = await prisma.compliance.count({
      where: {
        company_id: companyId,
        due_date: { lt: today },
        status: { notIn: ["APPROVED", "REJECTED"] },
      },
    });

    const statuses = await prisma.statusMaster.findMany({
      where: { company_id: companyId, module: "COMPLIANCE" },
    });

    const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s.name]));

    return NextResponse.json({
      total,
      overdue,
      byStatus: stats.map((s) => ({
        name: statusMap[s.status_id] || "Unknown",
        count: s._count,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

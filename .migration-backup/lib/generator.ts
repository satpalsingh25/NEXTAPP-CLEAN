import { prisma } from "@/lib/prisma";
import { ensureStatusExists } from "@/lib/seedStatuses";

export async function runComplianceGenerator(): Promise<void> {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year  = today.getFullYear();

  //-----------------------------------
  // Get master compliances
  //-----------------------------------

  const masters = await prisma.compliance.findMany({
    where: { is_recurring_master: true },
  });

  for (const m of masters) {

    //-----------------------------------
    // Check already exists
    //-----------------------------------

    const exists = await prisma.compliance.findFirst({
      where: {
        parent_id:    m.id,
        period_month: month,
        period_year:  year,
      },
    });

    if (exists) continue;

    //-----------------------------------
    // Resolve DRAFT status for company
    //-----------------------------------

    const status_id = await ensureStatusExists(m.company_id, "COMPLIANCE");

    //-----------------------------------
    // Create new instance
    //-----------------------------------

    const due_date = new Date(year, month - 1, m.due_day ?? 1);

    const newRecord = await prisma.compliance.create({
      data: {
        company_id:      m.company_id,
        name:            `${m.name} - ${month}/${year}`,
        template_id:     m.template_id,
        department_id:   m.department_id,
        function_id:     m.function_id,
        assigned_user_id: m.assigned_user_id,
        start_date:      today,
        due_date,
        period_month:    month,
        period_year:     year,
        status:          "DRAFT",
        status_id,
        parent_id:       m.id,
        current_level:   0,
      },
    });

    //-----------------------------------
    // Copy approval matrix
    //-----------------------------------

    const approvals = await prisma.complianceApprovalLevel.findMany({
      where: { compliance_id: m.id },
    });

    for (const a of approvals) {
      await prisma.complianceApprovalLevel.create({
        data: {
          compliance_id: newRecord.id,
          approver_id:   a.approver_id,
          level:         a.level,
          status:        "PENDING",
        },
      });
    }

    console.log("[generator] Created:", newRecord.name);
  }
}

import { prisma } from "@/lib/prisma";
import { notifyUser } from "./notification";

export async function runEscalationCheck(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  //-------------------------------------
  // Compliance escalation
  //-------------------------------------

  const compliances = await prisma.compliance.findMany({
    where: {
      status:          "OVERDUE",
      escalation_days: { not: null },
      due_date:        { not: undefined },
    },
    select: {
      id:              true,
      name:            true,
      company_id:      true,
      due_date:        true,
      escalation_days: true,
    },
  });

  for (const c of compliances) {
    if (!c.due_date || c.escalation_days == null) continue;

    const escalationDate = new Date(c.due_date);
    escalationDate.setDate(escalationDate.getDate() + c.escalation_days);
    escalationDate.setHours(0, 0, 0, 0);

    if (today < escalationDate) continue;

    // Notify all admins in the company
    const admins = await prisma.user.findMany({
      where: {
        company_id: c.company_id,
        role:       { in: ["ADMIN", "SUPER_ADMIN"] },
        is_active:  true,
      },
      select: { id: true },
    });

    for (const admin of admins) {
      await notifyUser(
        admin.id,
        "Compliance Escalation Alert",
        `Compliance "${c.name}" is overdue beyond the escalation limit of ${c.escalation_days} day(s). Immediate attention required.`,
        undefined,
        c.id,
        "COMPLIANCE",
      );
    }

    console.log(`[escalation] Compliance escalation triggered: ${c.name}`);
  }

  //-------------------------------------
  // AMC escalation
  //-------------------------------------

  const amcs = await prisma.aMC.findMany({
    where: {
      status:          "OVERDUE",
      escalation_days: { not: null },
      due_date:        { not: null },
    },
    select: {
      id:              true,
      name:            true,
      company_id:      true,
      due_date:        true,
      escalation_days: true,
    },
  });

  for (const a of amcs) {
    if (!a.due_date || a.escalation_days == null) continue;

    const escalationDate = new Date(a.due_date);
    escalationDate.setDate(escalationDate.getDate() + a.escalation_days);
    escalationDate.setHours(0, 0, 0, 0);

    if (today < escalationDate) continue;

    // Notify all admins in the company
    const admins = await prisma.user.findMany({
      where: {
        company_id: a.company_id,
        role:       { in: ["ADMIN", "SUPER_ADMIN"] },
        is_active:  true,
      },
      select: { id: true },
    });

    for (const admin of admins) {
      await notifyUser(
        admin.id,
        "AMC Escalation Alert",
        `AMC record "${a.name}" is overdue beyond the escalation limit of ${a.escalation_days} day(s). Immediate attention required.`,
        undefined,
        a.id,
        "AMC",
      );
    }

    console.log(`[escalation] AMC escalation triggered: ${a.name}`);
  }
}

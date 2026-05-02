import { prisma } from "@/lib/prisma";
import { notifyUser } from "./notification";

export async function runReminderEngine(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  //-------------------------------------
  // Compliance reminders
  //-------------------------------------

  const compliances = await prisma.compliance.findMany({
    where: {
      status:        { in: ["DRAFT", "SUBMITTED"] },
      reminder_days: { not: null },
      due_date:      { not: undefined },
    },
    include: {
      assignedUser: { select: { id: true, name: true } },
      approval_levels: {
        where:  { status: "PENDING" },
        select: { approver_id: true },
      },
    },
  });

  // Collect all approver IDs for compliance
  const complianceApproverIds = Array.from(
    new Set(compliances.flatMap((c) => c.approval_levels.map((l) => l.approver_id))),
  );
  const complianceApproverMap = complianceApproverIds.length
    ? Object.fromEntries(
        (await prisma.user.findMany({
          where:  { id: { in: complianceApproverIds } },
          select: { id: true, name: true },
        })).map((u) => [u.id, u.name ?? ""]),
      )
    : {} as Record<string, string>;

  for (const c of compliances) {
    if (!c.due_date || c.reminder_days == null) continue;

    const reminderDate = new Date(c.due_date);
    reminderDate.setDate(reminderDate.getDate() - c.reminder_days);
    reminderDate.setHours(0, 0, 0, 0);

    if (reminderDate.getTime() !== today.getTime()) continue;

    const dueDateStr = c.due_date.toDateString();

    // Notify assigned user
    if (c.assigned_user_id) {
      await notifyUser(
        c.assigned_user_id,
        "Compliance Reminder",
        `Your compliance "${c.name}" is due on ${dueDateStr}. Please take action.`,
        {
          type:      "REMINDER",
          companyId: c.company_id,
          vars: {
            user_name:       c.assignedUser?.name ?? "",
            compliance_name: c.name,
            due_date:        dueDateStr,
          },
        },
        c.id,
        "COMPLIANCE",
      );
    }

    // Notify pending approvers
    for (const level of c.approval_levels) {
      await notifyUser(
        level.approver_id,
        "Compliance Approval Reminder",
        `The compliance "${c.name}" is due on ${dueDateStr} and is awaiting your approval.`,
        {
          type:      "APPROVAL",
          companyId: c.company_id,
          vars: {
            user_name:       complianceApproverMap[level.approver_id] ?? "",
            compliance_name: c.name,
            due_date:        dueDateStr,
          },
        },
        c.id,
        "COMPLIANCE",
      );
    }

    console.log(`[reminder] Compliance reminder sent: ${c.name}`);
  }

  //-------------------------------------
  // AMC reminders
  //-------------------------------------

  const amcs = await prisma.aMC.findMany({
    where: {
      status:        { in: ["DRAFT", "SUBMITTED"] },
      reminder_days: { not: null },
      due_date:      { not: null },
    },
    include: {
      assignedUser: { select: { id: true, name: true } },
      approval_levels: {
        where:   { status: "PENDING" },
        include: { approver: { select: { id: true, name: true } } },
      },
    },
  });

  for (const a of amcs) {
    if (!a.due_date || a.reminder_days == null) continue;

    const reminderDate = new Date(a.due_date);
    reminderDate.setDate(reminderDate.getDate() - a.reminder_days);
    reminderDate.setHours(0, 0, 0, 0);

    if (reminderDate.getTime() !== today.getTime()) continue;

    const dueDateStr = a.due_date.toDateString();

    // Notify assigned user
    if (a.assigned_user_id) {
      await notifyUser(
        a.assigned_user_id,
        "AMC Reminder",
        `Your AMC record "${a.name}" is due on ${dueDateStr}. Please take action.`,
        {
          type:      "REMINDER",
          companyId: a.company_id,
          vars: {
            user_name:       a.assignedUser?.name ?? "",
            compliance_name: a.name,
            due_date:        dueDateStr,
          },
        },
        a.id,
        "AMC",
      );
    }

    // Notify pending approvers
    for (const level of a.approval_levels) {
      await notifyUser(
        level.approver_id,
        "AMC Approval Reminder",
        `The AMC record "${a.name}" is due on ${dueDateStr} and is awaiting your approval.`,
        {
          type:      "APPROVAL",
          companyId: a.company_id,
          vars: {
            user_name:       level.approver?.name ?? "",
            compliance_name: a.name,
            due_date:        dueDateStr,
          },
        },
        a.id,
        "AMC",
      );
    }

    console.log(`[reminder] AMC reminder sent: ${a.name}`);
  }
}

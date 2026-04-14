import { prisma } from "@/lib/prisma";
import { Module, Action, Role } from "@prisma/client";

export async function submitForApproval({
  companyId,
  userId,
  module,
  recordId,
}: {
  companyId: string;
  userId: string;
  module: Module;
  recordId: string;
}) {
  const data = {
    current_approval_level: 1,
  };

  if (module === "COMPLIANCE") {
    await prisma.compliance.update({
      where: { id: recordId },
      data: { ...data, submitted_by: userId },
    });
  } else if (module === "AMC") {
    await prisma.aMC.update({
      where: { id: recordId },
      data: data,
    });
  }

  await prisma.approvalLog.create({
    data: {
      company_id: companyId,
      module,
      record_id: recordId,
      level_number: 0,
      action: "SUBMITTED",
      action_by: userId,
      remarks: "Initial submission",
    },
  });
}

export async function processApproval({
  companyId,
  userId,
  module,
  recordId,
  action,
  remarks,
}: {
  companyId: string;
  userId: string;
  module: Module;
  recordId: string;
  action: "APPROVED" | "REJECTED";
  remarks?: string;
}) {
  const record =
    module === "COMPLIANCE"
      ? await prisma.compliance.findUnique({ where: { id: recordId } })
      : await prisma.aMC.findUnique({ where: { id: recordId } });

  if (!record) throw new Error("Record not found");

  if (action === "REJECTED") {
    const status = await prisma.statusMaster.findFirst({
      where: { company_id: companyId, module, name: "Rejected" },
    });

    const updateData = {
      current_approval_level: 0,
      status_id: status?.id,
    };

    if (module === "COMPLIANCE") {
      await prisma.compliance.update({ where: { id: recordId }, data: updateData });
    } else {
      await prisma.aMC.update({ where: { id: recordId }, data: updateData });
    }

    await prisma.approvalLog.create({
      data: {
        company_id: companyId,
        module,
        record_id: recordId,
        level_number: record.current_approval_level,
        action: "REJECTED",
        action_by: userId,
        remarks,
      },
    });
    return;
  }

  const nextLevel = await prisma.approvalMatrix.findFirst({
    where: {
      company_id: companyId,
      module,
      level_number: record.current_approval_level + 1,
    },
  });

  if (nextLevel) {
    const updateData = { current_approval_level: nextLevel.level_number };
    if (module === "COMPLIANCE") {
      await prisma.compliance.update({ where: { id: recordId }, data: updateData });
    } else {
      await prisma.aMC.update({ where: { id: recordId }, data: updateData });
    }
  } else {
    const approvedStatus = await prisma.statusMaster.findFirst({
      where: { company_id: companyId, module, name: "Approved" },
    });

    const updateData = { status_id: approvedStatus?.id };
    if (module === "COMPLIANCE") {
      await prisma.compliance.update({
        where: { id: recordId },
        data: { ...updateData, approved_by: userId },
      });
    } else {
      await prisma.aMC.update({ where: { id: recordId }, data: updateData });
    }
  }

  await prisma.approvalLog.create({
    data: {
      company_id: companyId,
      module,
      record_id: recordId,
      level_number: record.current_approval_level,
      action: "APPROVED",
      action_by: userId,
      remarks,
    },
  });
}

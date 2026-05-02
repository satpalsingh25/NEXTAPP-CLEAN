import { prisma } from "@/lib/prisma";

export async function runOverdueCheck() {
  const today = new Date();

  //-------------------------------------
  // Compliance
  //-------------------------------------

  await prisma.compliance.updateMany({
    where: {
      due_date: {
        lt: today,
      },
      status: {
        in: ["DRAFT", "PENDING", "SUBMITTED"],
      },
    },
    data: {
      status: "OVERDUE",
    },
  });

  //-------------------------------------
  // AMC
  //-------------------------------------

  await prisma.aMC.updateMany({
    where: {
      due_date: {
        lt: today,
      },
      status: {
        in: ["DRAFT", "PENDING", "SUBMITTED"],
      },
    },
    data: {
      status: "OVERDUE",
    },
  });

  console.log("[overdue] Overdue check completed");
}

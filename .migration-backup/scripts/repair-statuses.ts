import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COMPLIANCE_STATUSES = [
  { name: "DRAFT",        order_index: 0, is_final: false },
  { name: "SUBMITTED",    order_index: 1, is_final: false },
  { name: "APPROVED",     order_index: 2, is_final: true  },
  { name: "REJECTED",     order_index: 3, is_final: true  },
  { name: "OVERDUE",      order_index: 4, is_final: false },
];

const AMC_STATUSES = [
  { name: "DRAFT",         order_index: 0, is_final: false },
  { name: "SUBMITTED",     order_index: 1, is_final: false },
  { name: "APPROVED",      order_index: 2, is_final: true  },
  { name: "REJECTED",      order_index: 3, is_final: true  },
  { name: "OVERDUE",       order_index: 4, is_final: false },
  { name: "EXPIRING_SOON", order_index: 5, is_final: false },
];

async function repairCompany(
  company_id: string,
  module: "COMPLIANCE" | "AMC",
  definitions: typeof COMPLIANCE_STATUSES
): Promise<number> {
  const existing = await prisma.statusMaster.findMany({
    where: { company_id, module },
    select: { name: true },
  });

  const existingNames = new Set(existing.map((s) => s.name));
  const missing = definitions.filter((d) => !existingNames.has(d.name));

  if (missing.length === 0) return 0;

  await prisma.statusMaster.createMany({
    data: missing.map((s) => ({
      company_id,
      module,
      name: s.name,
      order_index: s.order_index,
      is_final: s.is_final,
    })),
    skipDuplicates: true,
  });

  return missing.length;
}

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });

  console.log(`[repair-statuses] Found ${companies.length} company/companies.`);

  let repairedCount = 0;

  for (const company of companies) {
    const complianceInserted = await repairCompany(company.id, "COMPLIANCE", COMPLIANCE_STATUSES);
    const amcInserted        = await repairCompany(company.id, "AMC",        AMC_STATUSES);

    if (complianceInserted > 0 || amcInserted > 0) {
      console.log(
        `[repair-statuses] Repaired "${company.name}" (${company.id}):` +
        ` +${complianceInserted} Compliance, +${amcInserted} AMC`
      );
      repairedCount++;
    } else {
      console.log(`[repair-statuses] "${company.name}" — no missing statuses.`);
    }
  }

  console.log(`[repair-statuses] Done. Repaired ${repairedCount} of ${companies.length} companies.`);
}

main()
  .catch((e) => {
    console.error("[repair-statuses] Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

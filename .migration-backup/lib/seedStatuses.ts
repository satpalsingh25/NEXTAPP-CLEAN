import { prisma } from "@/lib/prisma";

const COMPLIANCE_STATUSES = [
  { name: "DRAFT",     order_index: 0, is_final: false },
  { name: "PENDING",   order_index: 1, is_final: false },
  { name: "SUBMITTED", order_index: 2, is_final: false },
  { name: "APPROVED",  order_index: 3, is_final: true  },
  { name: "REJECTED",  order_index: 4, is_final: true  },
  { name: "OVERDUE",   order_index: 5, is_final: false },
];

const AMC_STATUSES = [
  { name: "DRAFT",         order_index: 0, is_final: false },
  { name: "PENDING",       order_index: 1, is_final: false },
  { name: "SUBMITTED",     order_index: 2, is_final: false },
  { name: "APPROVED",      order_index: 3, is_final: true  },
  { name: "REJECTED",      order_index: 4, is_final: true  },
  { name: "OVERDUE",       order_index: 5, is_final: false },
  { name: "EXPIRING_SOON", order_index: 6, is_final: false },
];

async function seedModuleStatuses(
  company_id: string,
  module: "COMPLIANCE" | "AMC",
  definitions: typeof COMPLIANCE_STATUSES
): Promise<void> {
  const existing = await prisma.statusMaster.findMany({
    where: { company_id, module },
    select: { name: true },
  });

  const existingNames = new Set(existing.map((s) => s.name));
  const missing = definitions.filter((d) => !existingNames.has(d.name));
  if (missing.length === 0) return;

  await prisma.statusMaster.createMany({
    data: missing.map((s) => ({
      company_id,
      module,
      name:        s.name,
      order_index: s.order_index,
      is_final:    s.is_final,
    })),
    skipDuplicates: true,
  });
}

export async function seedCompanyStatuses(company_id: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: company_id },
    select: { id: true },
  });

  if (!company) {
    console.warn(`[seedStatuses] Company ${company_id} not found — skipping.`);
    return;
  }

  await seedModuleStatuses(company.id, "COMPLIANCE", COMPLIANCE_STATUSES);
  await seedModuleStatuses(company.id, "AMC",        AMC_STATUSES);
}

export async function ensureStatusExists(
  company_id: string,
  module: "COMPLIANCE" | "AMC"
): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: company_id },
    select: { id: true },
  });

  if (!company) {
    throw new Error("INVALID_COMPANY");
  }

  const definitions = module === "COMPLIANCE" ? COMPLIANCE_STATUSES : AMC_STATUSES;

  await seedModuleStatuses(company.id, module, definitions);

  const status = await prisma.statusMaster.findFirst({
    where: { company_id: company.id, module, name: "DRAFT" },
    orderBy: { order_index: "asc" },
  });

  if (!status) {
    throw new Error(`SEED_FAILED:${module}`);
  }

  return status.id;
}

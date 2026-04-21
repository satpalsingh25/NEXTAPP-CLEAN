import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const modules = ["AMC", "COMPLIANCE", "DMS"];

  for (const name of modules) {
    await prisma.module.upsert({
      where:  { name },
      update: {},
      create: { name },
    });
  }

  console.log("Modules seeded");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

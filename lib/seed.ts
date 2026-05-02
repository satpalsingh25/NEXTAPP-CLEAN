import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { seedCompanyStatuses } from "./seedStatuses";

export async function seed() {
  try {
    // ── Company ───────────────────────────────────────────────────────────────
    // Use find-first + conditional create with catch to handle concurrent runs
    let company = await prisma.company.findFirst({
      where: { name: "Default Company" },
    });

    if (!company) {
      try {
        company = await prisma.company.create({
          data: { name: "Default Company", primary_color: "#2563eb" },
        });
      } catch {
        // Another worker created it — fetch the existing one
        company = await prisma.company.findFirst({
          where: { name: "Default Company" },
        });
      }
    }

    if (!company) throw new Error("[seed] Failed to resolve default company");

    // ── Admin user (upsert by unique email) ───────────────────────────────────
    const adminEmail = "admin@local.com";
    const hashedPassword = await bcrypt.hash("Admin123", 10);

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        password_hash: hashedPassword,
        role: "SUPER_ADMIN",
        is_active: true,
        company_id: company.id,
      },
    });
    console.log("[seed] Admin user already exists.");

    // ── Compliance template ───────────────────────────────────────────────────
    const existingTemplate = await prisma.complianceTemplate.findFirst({
      where: { company_id: company.id, title: "Default Compliance Template" },
    });
    if (!existingTemplate) {
      try {
        await prisma.complianceTemplate.create({
          data: {
            company_id: company.id,
            title: "Default Compliance Template",
            frequency: "MONTHLY",
          },
        });
      } catch {
        // Another worker already created it — safe to ignore
      }
    }
    console.log("[seed] Compliance template already exists.");

    // ── Statuses (idempotent via skipDuplicates) ──────────────────────────────
    const allCompanies = await prisma.company.findMany({ select: { id: true } });
    for (const c of allCompanies) {
      await seedCompanyStatuses(c.id);
    }
    const complianceCount = await prisma.statusMaster.count({
      where: { company_id: company.id, module: "COMPLIANCE" },
    });
    const amcCount = await prisma.statusMaster.count({
      where: { company_id: company.id, module: "AMC" },
    });
    console.log(`[seed] Compliance statuses already exist: ${complianceCount}`);
    console.log(`[seed] AMC statuses already exist: ${amcCount}`);

    // ── AMC template ──────────────────────────────────────────────────────────
    const existingAMCTemplate = await prisma.aMCTemplate.findFirst({
      where: { company_id: company.id, name: "Default AMC Template" },
    });
    if (!existingAMCTemplate) {
      try {
        await prisma.aMCTemplate.create({
          data: {
            company_id: company.id,
            name: "Default AMC Template",
            frequency: "Yearly",
            approval_levels: 1,
          },
        });
      } catch {
        // Another worker already created it — safe to ignore
      }
    }
    console.log("[seed] AMC template already exists.");

    // ── Modules (master list for feature gating) ──────────────────────────────
    const moduleNames = ["AMC", "COMPLIANCE", "DMS"];
    for (const name of moduleNames) {
      await prisma.module.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }
    console.log("[seed] Modules seeded: AMC, COMPLIANCE, DMS.");

    console.log("[seed] Seed complete.");
  } catch (error) {
    console.error("[seed] Seed failed:", error);
  }
}

// Keep legacy export name for backwards compatibility
export { seed as seedData };

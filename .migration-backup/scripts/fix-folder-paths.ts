/**
 * One-time data-fix: replace legacy slug paths with the correct format.
 *
 * Old format  → "default-company" (slug: lowercase + hyphens)
 * New format  → "Default_Company" (spaces replaced with underscores, casing preserved)
 *
 * Affected tables:
 *   DmsFolder.path
 *   DmsDocument.folder_path
 *
 * Run:
 *   npx ts-node -P tsconfig.json scripts/fix-folder-paths.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Builds a case-insensitive replacement map from the Company table:
 *   company_folder_name (correct) → old slug (lowercase + hyphens)
 *
 * Example:
 *   "Default_Company" → "default-company"
 *   "Acme_Corp"       → "acme-corp"
 */
async function buildReplacementMap(): Promise<Array<{ oldSlug: string; newName: string }>> {
  const companies = await prisma.company.findMany({
    select: { name: true, company_folder_name: true },
  });

  return companies.map((c) => {
    const newName =
      (c.company_folder_name?.trim()) ||
      c.name.replace(/\s+/g, "_");

    /* Old slug: lowercase, spaces and underscores → hyphens */
    const oldSlug = c.name.trim().toLowerCase().replace(/[\s_]+/g, "-");

    return { oldSlug, newName };
  });
}

async function main() {
  console.log("=== DMS folder path fix ===\n");

  const replacements = await buildReplacementMap();
  console.log("Replacement map:");
  replacements.forEach(({ oldSlug, newName }) =>
    console.log(`  "${oldSlug}" → "${newName}"`),
  );
  console.log();

  let folderTotal = 0;
  let docTotal    = 0;

  for (const { oldSlug, newName } of replacements) {
    /* ── DmsFolder.path ─────────────────────────────────────────────── */
    const folderResult = await prisma.$executeRawUnsafe(
      `UPDATE "DmsFolder" SET path = REPLACE(path, $1, $2) WHERE path LIKE '%' || $1 || '%'`,
      oldSlug,
      newName,
    );
    folderTotal += folderResult;
    if (folderResult > 0) {
      console.log(`DmsFolder: updated ${folderResult} row(s)  "${oldSlug}" → "${newName}"`);
    }

    /* ── DmsDocument.folder_path ────────────────────────────────────── */
    const docResult = await prisma.$executeRawUnsafe(
      `UPDATE "DmsDocument" SET folder_path = REPLACE(folder_path, $1, $2) WHERE folder_path LIKE '%' || $1 || '%'`,
      oldSlug,
      newName,
    );
    docTotal += docResult;
    if (docResult > 0) {
      console.log(`DmsDocument: updated ${docResult} row(s)  "${oldSlug}" → "${newName}"`);
    }
  }

  console.log(`\nDone. DmsFolder: ${folderTotal} updated, DmsDocument: ${docTotal} updated.`);
}

main()
  .catch((e) => {
    console.error("Fix failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

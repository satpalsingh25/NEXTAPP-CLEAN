import { NextRequest, NextResponse } from "next/server";
import { prisma }                   from "@/lib/prisma";
import { requireRole }              from "@/lib/auth.server";

/* ------------------------------------------------------------------ */
/* GET /api/admin/company-modules?company_id=…                          */
/*                                                                      */
/* Lists every module in the master with the target company's         */
/* enabled flag (defaults to `true` when no mapping row exists).      */
/* SUPER_ADMIN only.                                                   */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ["SUPER_ADMIN"]);
  if ("error" in auth) return auth.error;

  const company_id = req.nextUrl.searchParams.get("company_id") ?? "";
  if (!company_id) {
    return NextResponse.json({ error: "company_id is required." }, { status: 400 });
  }

  const modules = await prisma.module.findMany({
    orderBy: { name: "asc" },
    include: {
      company_modules: {
        where: { company_id },
      },
    },
  });

  const result = modules.map((m) => ({
    id:      m.id,
    name:    m.name,
    enabled: m.company_modules[0]?.enabled ?? true,
  }));

  return NextResponse.json(result);
}

/* ------------------------------------------------------------------ */
/* POST /api/admin/company-modules                                      */
/*                                                                      */
/* Body: { company_id, modules: [{ module_id, enabled }] }             */
/* Upserts a CompanyModule row for each entry. SUPER_ADMIN only.       */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ["SUPER_ADMIN"]);
  if ("error" in auth) return auth.error;

  let body: { company_id?: string; modules?: { module_id: string; enabled: boolean }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { company_id, modules } = body;
  if (!company_id) {
    return NextResponse.json({ error: "company_id is required." }, { status: 400 });
  }
  if (!Array.isArray(modules)) {
    return NextResponse.json({ error: "modules array is required." }, { status: 400 });
  }

  for (const m of modules) {
    if (!m.module_id || typeof m.enabled !== "boolean") continue;
    await prisma.companyModule.upsert({
      where: {
        company_id_module_id: {
          company_id,
          module_id: m.module_id,
        },
      },
      update: { enabled: m.enabled },
      create: {
        company_id,
        module_id: m.module_id,
        enabled:   m.enabled,
      },
    });
  }

  return NextResponse.json({ success: true });
}

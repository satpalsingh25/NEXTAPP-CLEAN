import { NextRequest, NextResponse } from "next/server";
import { prisma }                   from "@/lib/prisma";
import { requireAuth }              from "@/lib/auth.server";

/* ------------------------------------------------------------------ */
/* GET /api/modules                                                     */
/*                                                                      */
/* Returns the master list of modules with each one's enabled flag    */
/* for the caller's company. When no CompanyModule mapping exists for */
/* a module, it defaults to enabled (matches hasModuleAccess).        */
/*                                                                      */
/* Response shape: [{ name: string, enabled: boolean }]                */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  const modules = await prisma.module.findMany({
    include: {
      company_modules: {
        where: { company_id },
      },
    },
  });

  const result = modules.map((m) => {
    const mapping = m.company_modules[0];
    return {
      name:    m.name,
      enabled: mapping ? mapping.enabled : true,
    };
  });

  return NextResponse.json(result);
}

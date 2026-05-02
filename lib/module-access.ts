import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@/lib/prisma";
import { requireAuth }               from "@/lib/auth.server";

/* ================================================================== */
/*  Module Access Control                                               */
/*                                                                      */
/*  Tenant-level feature gating backed by the `Module` master and       */
/*  `CompanyModule` mapping table.                                      */
/*                                                                      */
/*  Rules:                                                              */
/*    • Module not in master         → false (unknown module)           */
/*    • No CompanyModule mapping     → true  (default ALLOW)            */
/*    • Mapping exists               → returns mapping.enabled          */
/* ================================================================== */

export async function hasModuleAccess(
  company_id: string,
  moduleName: string,
): Promise<boolean> {
  const module = await prisma.module.findUnique({
    where: { name: moduleName },
  });

  if (!module) return false;

  const mapping = await prisma.companyModule.findUnique({
    where: {
      company_id_module_id: {
        company_id,
        module_id: module.id,
      },
    },
  });

  /* Not configured → default allow */
  if (!mapping) return true;

  return mapping.enabled;
}

/* ------------------------------------------------------------------ */
/* Route helper                                                         */
/*                                                                      */
/*  Use at the top of any API route guarded by module access.          */
/*  Throws on failure — caller should catch and return 403.            */
/*                                                                      */
/*  Example:                                                            */
/*    const auth = requireAuth(req);                                    */
/*    if ("error" in auth) return auth.error;                           */
/*    try { await requireModuleAccess(req, "AMC"); }                    */
/*    catch (e) { return NextResponse.json({error:e.message},{status:403}); } */
/* ------------------------------------------------------------------ */
export async function requireModuleAccess(
  req:        NextRequest,
  moduleName: string,
): Promise<void> {
  const auth = requireAuth(req);
  if ("error" in auth) {
    throw new Error("Unauthorized");
  }

  const allowed = await hasModuleAccess(auth.user.company_id, moduleName);
  if (!allowed) {
    throw new Error("Module not enabled for this company");
  }
}

/* ------------------------------------------------------------------ */
/* gateModule                                                           */
/*                                                                      */
/*  Drop-in route gate. Returns a 403 NextResponse if the module is    */
/*  disabled for the caller's company; returns null when access is OK. */
/*                                                                      */
/*  Pattern (parallels requireAuth's `error` shape):                    */
/*    const gate = await gateModule(req, "AMC");                        */
/*    if (gate) return gate;                                            */
/* ------------------------------------------------------------------ */
export async function gateModule(
  req:        NextRequest,
  moduleName: string,
): Promise<NextResponse | null> {
  try {
    await requireModuleAccess(req, moduleName);
    return null;
  } catch (e) {
    const msg = (e as Error).message;
    const status = msg === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: "Module not enabled" }, { status });
  }
}

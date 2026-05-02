import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";

/* GET /api/admin/dms-team-folders — list all TEAM root folders for the company */
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  const folders = await prisma.dmsFolder.findMany({
    where:   { company_id, type: "TEAM", parent_id: null },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, path: true, created_at: true },
  });

  return NextResponse.json(folders);
}

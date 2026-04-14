import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";

/* GET /api/dms/user-settings
   Returns the subset of DmsSettings that the frontend needs. */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  const settings = await prisma.dmsSettings.findUnique({ where: { company_id } });

  return NextResponse.json({
    allow_user_folder_creation: settings?.allow_user_folder_creation ?? false,
  });
}

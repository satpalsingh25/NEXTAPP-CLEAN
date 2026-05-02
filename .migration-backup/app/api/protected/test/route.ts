import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id: companyId } = auth.user;

  const users = await prisma.user.findMany({
    where: { company_id: companyId },
  });

  return NextResponse.json({ users });
}

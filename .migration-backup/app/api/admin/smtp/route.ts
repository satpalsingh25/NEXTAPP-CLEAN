import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";
import { decryptPassword } from "@/lib/smtp-crypto";

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  const config = await prisma.smtpConfig.findUnique({
    where: { company_id },
  });

  if (!config) return NextResponse.json(null);

  return NextResponse.json({
    ...config,
    password: config.password ? decryptPassword(config.password) : "",
  });
}

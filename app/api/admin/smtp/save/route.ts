import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";
import { encryptPassword } from "@/lib/smtp-crypto";

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  const body = await req.json().catch(() => ({}));
  const { host, port, username, password, from_email, secure, is_active } = body as {
    host: string;
    port: number;
    username: string;
    password: string;
    from_email: string;
    secure: boolean;
    is_active?: boolean;
  };

  if (!host?.trim())       return NextResponse.json({ error: "SMTP host is required." },       { status: 400 });
  if (!port)               return NextResponse.json({ error: "Port is required." },             { status: 400 });
  if (!username?.trim())   return NextResponse.json({ error: "Username is required." },         { status: 400 });
  if (!from_email?.trim()) return NextResponse.json({ error: "From Email is required." },       { status: 400 });

  const encryptedPassword = password ? encryptPassword(password) : undefined;

  const existing = await prisma.smtpConfig.findUnique({ where: { company_id } });

  const data = {
    host:       host.trim(),
    port:       Number(port),
    username:   username.trim(),
    from_email: from_email.trim(),
    secure:     Boolean(secure),
    is_active:  is_active !== false,
    ...(encryptedPassword ? { password: encryptedPassword } : {}),
  };

  let config;
  if (existing) {
    config = await prisma.smtpConfig.update({
      where: { company_id },
      data,
    });
  } else {
    if (!password) return NextResponse.json({ error: "Password is required." }, { status: 400 });
    config = await prisma.smtpConfig.create({
      data: { company_id, password: encryptedPassword!, ...data },
    });
  }

  return NextResponse.json({ message: "SMTP configuration saved.", id: config.id });
}

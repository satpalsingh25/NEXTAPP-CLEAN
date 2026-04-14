import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";
import { EmailTemplateType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  const templates = await prisma.emailTemplate.findMany({
    where: { company_id },
    orderBy: { type: "asc" },
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  const body = await req.json();
  const { type, subject, body: templateBody } = body as {
    type: EmailTemplateType;
    subject: string;
    body: string;
  };

  if (!type || !subject || !templateBody) {
    return NextResponse.json({ error: "type, subject and body are required" }, { status: 400 });
  }

  if (!["REMINDER", "APPROVAL", "OVERDUE"].includes(type)) {
    return NextResponse.json({ error: "Invalid template type" }, { status: 400 });
  }

  const template = await prisma.emailTemplate.upsert({
    where:  { company_id_type: { company_id, type } },
    update: { subject, body: templateBody },
    create: { company_id, type, subject, body: templateBody },
  });

  return NextResponse.json(template);
}

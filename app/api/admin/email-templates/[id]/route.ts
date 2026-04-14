import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;
  const { id } = await params;

  const existing = await prisma.emailTemplate.findFirst({
    where: { id, company_id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await req.json();
  const { subject, body: templateBody } = body as {
    subject: string;
    body: string;
  };

  if (!subject || !templateBody) {
    return NextResponse.json({ error: "subject and body are required" }, { status: 400 });
  }

  const updated = await prisma.emailTemplate.update({
    where: { id },
    data:  { subject, body: templateBody },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;
  const { id } = await params;

  const existing = await prisma.emailTemplate.findFirst({
    where: { id, company_id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  await prisma.emailTemplate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

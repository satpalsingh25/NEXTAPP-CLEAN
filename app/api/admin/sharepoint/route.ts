import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";
import { encryptPassword, decryptPassword } from "@/lib/smtp-crypto";

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  const config = await prisma.sharePointConfig.findUnique({
    where: { company_id },
  });

  if (!config) return NextResponse.json(null);

  return NextResponse.json({
    ...config,
    client_secret: config.client_secret ? decryptPassword(config.client_secret) : "",
  });
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  const body = await req.json();
  const { tenant_id, client_id, client_secret, site_url, document_library } = body as {
    tenant_id:        string;
    client_id:        string;
    client_secret:    string;
    site_url:         string;
    document_library: string;
  };

  if (!tenant_id || !client_id || !site_url || !document_library) {
    return NextResponse.json(
      { error: "tenant_id, client_id, site_url, and document_library are required" },
      { status: 400 },
    );
  }

  const existing = await prisma.sharePointConfig.findUnique({ where: { company_id } });

  if (!existing && !client_secret) {
    return NextResponse.json({ error: "client_secret is required" }, { status: 400 });
  }

  const encryptedSecret = client_secret
    ? encryptPassword(client_secret)
    : existing!.client_secret;

  if (existing) {
    await prisma.sharePointConfig.update({
      where: { company_id },
      data: {
        tenant_id,
        client_id,
        client_secret: encryptedSecret,
        site_url,
        document_library,
      },
    });
  } else {
    await prisma.sharePointConfig.create({
      data: {
        company_id,
        tenant_id,
        client_id,
        client_secret: encryptedSecret,
        site_url,
        document_library,
      },
    });
  }

  return NextResponse.json({ success: true });
}

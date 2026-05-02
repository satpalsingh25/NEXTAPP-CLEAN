import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";
import { decryptPassword } from "@/lib/smtp-crypto";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, email: userEmail } = auth.user;

  const config = await prisma.smtpConfig.findUnique({ where: { company_id } });
  if (!config) {
    return NextResponse.json({ error: "No SMTP configuration found. Save your settings first." }, { status: 404 });
  }

  const password = decryptPassword(config.password);

  try {
    const transporter = nodemailer.createTransport({
      host:   config.host,
      port:   config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: password,
      },
    });

    await transporter.sendMail({
      from:    config.from_email,
      to:      userEmail,
      subject: "SMTP Test — Compliance & AMC System",
      text:    "This is a test email to confirm your SMTP configuration is working correctly.",
      html:    `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1e293b;margin-bottom:8px">SMTP Test Successful</h2>
          <p style="color:#475569">Your SMTP configuration is working correctly.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
          <p style="color:#94a3b8;font-size:12px">Sent from Compliance &amp; AMC Management System</p>
        </div>
      `,
    });

    return NextResponse.json({ message: `Test email sent to ${userEmail}.` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to send test email: ${message}` }, { status: 500 });
  }
}

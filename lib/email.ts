import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptPassword } from "@/lib/smtp-crypto";

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const config = await prisma.smtpConfig.findFirst({
    where: { is_active: true },
  });

  if (!config) {
    console.log("[email] SMTP not configured");
    return;
  }

  const transporter = nodemailer.createTransport({
    host:   config.host,
    port:   config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: decryptPassword(config.password),
    },
  });

  await transporter.sendMail({
    from:    config.from_email,
    to,
    subject,
    text,
  });
}

import { prisma } from "@/lib/prisma";
import { sendEmail } from "./email";
import { resolveEmailContent, TemplateVars } from "./email-template";
import { EmailTemplateType } from "@prisma/client";

export type NotifyTemplateOptions = {
  type:      EmailTemplateType;
  companyId: string;
  vars:      TemplateVars;
};

export async function notifyUser(
  userId:          string,
  title:           string,
  message:         string,
  templateOptions?: NotifyTemplateOptions,
  recordId?:        string,
  recordModule?:    string,
): Promise<void> {

  //-------------------------------------
  // Save in DB
  //-------------------------------------

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  await prisma.notification.create({
    data: {
      user_id:       userId,
      title,
      message,
      type:          "REMINDER",
      record_id:     recordId    ?? null,
      record_module: recordModule ?? null,
    },
  });

  //-------------------------------------
  // Send Email
  //-------------------------------------

  if (user?.email) {
    if (templateOptions) {
      const resolved = await resolveEmailContent(
        templateOptions.type,
        templateOptions.companyId,
        templateOptions.vars,
      );
      if (resolved) {
        await sendEmail(user.email, resolved.subject, resolved.body);
        return;
      }
    }
    // Fallback to static text if no template found
    await sendEmail(user.email, title, message);
  }
}

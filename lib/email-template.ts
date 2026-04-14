import { prisma } from "@/lib/prisma";
import { EmailTemplateType } from "@prisma/client";

export type TemplateVars = {
  user_name?:       string;
  compliance_name?: string;
  due_date?:        string;
};

function interpolate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{user_name\}\}/g,       vars.user_name       ?? "")
    .replace(/\{\{compliance_name\}\}/g, vars.compliance_name ?? "")
    .replace(/\{\{due_date\}\}/g,        vars.due_date        ?? "");
}

export async function resolveEmailContent(
  type:      EmailTemplateType,
  companyId: string,
  vars:      TemplateVars,
): Promise<{ subject: string; body: string } | null> {
  const tpl = await prisma.emailTemplate.findUnique({
    where: { company_id_type: { company_id: companyId, type } },
  });

  if (!tpl) return null;

  return {
    subject: interpolate(tpl.subject, vars),
    body:    interpolate(tpl.body,    vars),
  };
}

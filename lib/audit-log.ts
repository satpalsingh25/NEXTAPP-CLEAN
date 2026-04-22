import prisma from "@/lib/prisma"

interface AuditLogInput {
  company_id: string
  user_id?: string
  action: string
  module: string
  entity_type?: string
  entity_id?: string
  description?: string
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({ data: input })
  } catch (err) {
    console.error("Audit log failed", err)
  }
}

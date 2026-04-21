import { prisma } from "@/lib/prisma";

export interface DmsActivityPayload {
  company_id:  string;
  user_id:     string;
  action:      string;
  entity_type: string;
  entity_id:   string;
  entity_name: string;
  details?:    Record<string, unknown>;
}

/**
 * Writes a single DMS activity log entry.
 * Failures are swallowed so they never block the main action.
 */
export async function logDmsActivity(payload: DmsActivityPayload): Promise<void> {
  try {
    await prisma.dmsActivityLog.create({
      data: {
        company_id:  payload.company_id,
        user_id:     payload.user_id,
        action:      payload.action,
        entity_type: payload.entity_type,
        entity_id:   payload.entity_id,
        entity_name: payload.entity_name,
        details:     payload.details ? JSON.stringify(payload.details) : null,
      },
    });
  } catch (e) {
    console.error("[dms-activity] Failed to write activity log:", (e as Error).message);
  }
}

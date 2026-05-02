import { runComplianceGenerator } from "@/lib/generator";
import { runOverdueCheck } from "@/lib/overdue";
import { runReminderEngine } from "@/lib/reminder";
import { runEscalationCheck } from "@/lib/escalation";

export async function GET() {
  await runComplianceGenerator();
  await runOverdueCheck();
  await runReminderEngine();
  await runEscalationCheck();

  return Response.json({
    message: "Cron executed successfully",
  });
}

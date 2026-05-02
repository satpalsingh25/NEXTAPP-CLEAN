import cron from "node-cron";
import { runComplianceGenerator } from "./generator";
import { runOverdueCheck } from "./overdue";
import { runReminderEngine } from "./reminder";
import { runEscalationCheck } from "./escalation";

export function startCron() {
  cron.schedule("0 1 * * *", async () => {
    console.log("Running daily automation...");

    await runComplianceGenerator();
    await runOverdueCheck();
    await runReminderEngine();
    await runEscalationCheck();

    console.log("Automation complete");
  });
}

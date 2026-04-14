export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { seed } = await import("./lib/seed");
    await seed();

    const { startCron } = await import("./lib/cron");
    startCron();
  }
}

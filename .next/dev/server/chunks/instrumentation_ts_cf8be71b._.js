module.exports = [
"[project]/instrumentation.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "register",
    ()=>register
]);
async function register() {
    if (("TURBOPACK compile-time value", "nodejs") === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
        const { seed } = await __turbopack_context__.A("[project]/lib/seed.ts [instrumentation] (ecmascript, async loader)");
        await seed();
        const { startCron } = await __turbopack_context__.A("[project]/lib/cron.ts [instrumentation] (ecmascript, async loader)");
        startCron();
    }
}
}),
];

//# sourceMappingURL=instrumentation_ts_cf8be71b._.js.map
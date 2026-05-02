module.exports = [
"[project]/lib/seed.ts [instrumentation] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "server/chunks/[root-of-the-server]__f9585670._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/lib/seed.ts [instrumentation] (ecmascript)");
    });
});
}),
"[project]/lib/cron.ts [instrumentation] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "server/chunks/[root-of-the-server]__22e2d29a._.js",
  "server/chunks/[root-of-the-server]__e105907e._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/lib/cron.ts [instrumentation] (ecmascript)");
    });
});
}),
];
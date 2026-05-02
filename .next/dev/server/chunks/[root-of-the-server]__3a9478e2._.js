module.exports = [
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/lib/incremental-cache/tags-manifest.external.js [external] (next/dist/server/lib/incremental-cache/tags-manifest.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/lib/incremental-cache/tags-manifest.external.js", () => require("next/dist/server/lib/incremental-cache/tags-manifest.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/proxy.ts [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "default",
    ()=>proxy
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [middleware] (ecmascript)");
;
const PROTECTED_PAGES = [
    "/dashboard",
    "/compliance",
    "/amc",
    "/admin",
    "/approvals"
];
const AUTH_PAGES = [
    "/auth/login",
    "/auth/register"
];
const ADMIN_ONLY = new Set([
    "ADMIN",
    "SUPER_ADMIN"
]);
const MANAGER_PLUS = new Set([
    "ADMIN",
    "SUPER_ADMIN",
    "MANAGER"
]);
const APPROVER_ONLY = new Set([
    "ADMIN",
    "SUPER_ADMIN",
    "APPROVER"
]);
const ALL_ROLES = new Set([
    "ADMIN",
    "SUPER_ADMIN",
    "MANAGER",
    "APPROVER",
    "USER",
    "CEO"
]);
function getRoleFromToken(req) {
    const token = req.cookies.get("token")?.value;
    if (!token) return null;
    try {
        const [, b64] = token.split(".");
        const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(padded));
        return payload.role ?? null;
    } catch  {
        return null;
    }
}
function matchesAny(pathname, prefixes) {
    return prefixes.some((p)=>pathname === p || pathname.startsWith(p + "/"));
}
function deny(req) {
    const url = req.nextUrl.clone();
    url.pathname = "/unauthorized";
    url.search = "";
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].redirect(url);
}
function proxy(req) {
    const { pathname } = req.nextUrl;
    const hasToken = !!req.cookies.get("token")?.value;
    // 1. Unauthenticated → login
    if (matchesAny(pathname, PROTECTED_PAGES) && !hasToken) {
        const url = req.nextUrl.clone();
        url.pathname = "/auth/login";
        url.searchParams.set("from", pathname);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].redirect(url);
    }
    // 2. Already logged in → skip auth pages
    if (matchesAny(pathname, AUTH_PAGES) && hasToken) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].redirect(url);
    }
    // 3. Role-based guards
    if (hasToken) {
        const role = getRoleFromToken(req);
        if (!role || !ALL_ROLES.has(role)) return deny(req);
        // ADMIN only — admin panel
        if (matchesAny(pathname, [
            "/admin"
        ])) {
            if (!ADMIN_ONLY.has(role)) return deny(req);
        }
        // ADMIN only — template management
        if (matchesAny(pathname, [
            "/compliance/templates",
            "/amc/templates"
        ])) {
            if (!ADMIN_ONLY.has(role)) return deny(req);
        }
        // ADMIN only — company-level approval matrix
        if (matchesAny(pathname, [
            "/compliance/approval-matrix",
            "/amc/approval-matrix"
        ])) {
            if (!ADMIN_ONLY.has(role)) return deny(req);
        }
        // ADMIN only — per-record approval matrix: /compliance/<id>/approval-matrix
        if (/^\/compliance\/[^/]+\/approval-matrix(\/|$)/.test(pathname)) {
            if (!ADMIN_ONLY.has(role)) return deny(req);
        }
        if (/^\/amc\/[^/]+\/approval-matrix(\/|$)/.test(pathname)) {
            if (!ADMIN_ONLY.has(role)) return deny(req);
        }
        // MANAGER+ only — create records
        if (matchesAny(pathname, [
            "/compliance/create",
            "/amc/create"
        ])) {
            if (!MANAGER_PLUS.has(role)) return deny(req);
        }
        // APPROVER / ADMIN only — pending approval queues (MANAGER excluded)
        if (matchesAny(pathname, [
            "/compliance/pending-approval",
            "/amc/pending-approval",
            "/amc/approvals",
            "/approvals"
        ])) {
            if (!APPROVER_ONLY.has(role)) return deny(req);
        }
    // CEO & USER: read-only — access to /compliance, /amc, /dashboard is allowed above.
    // Write actions are enforced at the API layer (MANAGER_PLUS / SUBMIT_ROLES).
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].next();
}
const config = {
    matcher: [
        "/dashboard",
        "/dashboard/:path+",
        "/compliance",
        "/compliance/:path+",
        "/amc",
        "/amc/:path+",
        "/admin",
        "/admin/:path+",
        "/approvals",
        "/approvals/:path+",
        "/auth/login",
        "/auth/register",
        "/auth/:path+"
    ]
};
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__3a9478e2._.js.map
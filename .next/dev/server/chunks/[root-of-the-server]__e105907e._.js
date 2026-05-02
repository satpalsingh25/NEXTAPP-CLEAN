module.exports = [
"[project]/lib/prisma.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "prisma",
    ()=>prisma
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
;
const globalForPrisma = /*TURBOPACK member replacement*/ __turbopack_context__.g;
const prisma = globalForPrisma.prisma || new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]();
if ("TURBOPACK compile-time truthy", 1) globalForPrisma.prisma = prisma;
}),
"[project]/lib/seedStatuses.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ensureStatusExists",
    ()=>ensureStatusExists,
    "seedCompanyStatuses",
    ()=>seedCompanyStatuses
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [instrumentation] (ecmascript)");
;
const COMPLIANCE_STATUSES = [
    {
        name: "DRAFT",
        order_index: 0,
        is_final: false
    },
    {
        name: "PENDING",
        order_index: 1,
        is_final: false
    },
    {
        name: "SUBMITTED",
        order_index: 2,
        is_final: false
    },
    {
        name: "APPROVED",
        order_index: 3,
        is_final: true
    },
    {
        name: "REJECTED",
        order_index: 4,
        is_final: true
    },
    {
        name: "OVERDUE",
        order_index: 5,
        is_final: false
    }
];
const AMC_STATUSES = [
    {
        name: "DRAFT",
        order_index: 0,
        is_final: false
    },
    {
        name: "PENDING",
        order_index: 1,
        is_final: false
    },
    {
        name: "SUBMITTED",
        order_index: 2,
        is_final: false
    },
    {
        name: "APPROVED",
        order_index: 3,
        is_final: true
    },
    {
        name: "REJECTED",
        order_index: 4,
        is_final: true
    },
    {
        name: "OVERDUE",
        order_index: 5,
        is_final: false
    },
    {
        name: "EXPIRING_SOON",
        order_index: 6,
        is_final: false
    }
];
async function seedModuleStatuses(company_id, module, definitions) {
    const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].statusMaster.findMany({
        where: {
            company_id,
            module
        },
        select: {
            name: true
        }
    });
    const existingNames = new Set(existing.map((s)=>s.name));
    const missing = definitions.filter((d)=>!existingNames.has(d.name));
    if (missing.length === 0) return;
    await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].statusMaster.createMany({
        data: missing.map((s)=>({
                company_id,
                module,
                name: s.name,
                order_index: s.order_index,
                is_final: s.is_final
            })),
        skipDuplicates: true
    });
}
async function seedCompanyStatuses(company_id) {
    const company = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].company.findUnique({
        where: {
            id: company_id
        },
        select: {
            id: true
        }
    });
    if (!company) {
        console.warn(`[seedStatuses] Company ${company_id} not found — skipping.`);
        return;
    }
    await seedModuleStatuses(company.id, "COMPLIANCE", COMPLIANCE_STATUSES);
    await seedModuleStatuses(company.id, "AMC", AMC_STATUSES);
}
async function ensureStatusExists(company_id, module) {
    const company = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].company.findUnique({
        where: {
            id: company_id
        },
        select: {
            id: true
        }
    });
    if (!company) {
        throw new Error("INVALID_COMPANY");
    }
    const definitions = module === "COMPLIANCE" ? COMPLIANCE_STATUSES : AMC_STATUSES;
    await seedModuleStatuses(company.id, module, definitions);
    const status = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].statusMaster.findFirst({
        where: {
            company_id: company.id,
            module,
            name: "DRAFT"
        },
        orderBy: {
            order_index: "asc"
        }
    });
    if (!status) {
        throw new Error(`SEED_FAILED:${module}`);
    }
    return status.id;
}
}),
"[project]/lib/generator.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "runComplianceGenerator",
    ()=>runComplianceGenerator
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedStatuses$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/seedStatuses.ts [instrumentation] (ecmascript)");
;
;
async function runComplianceGenerator() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    //-----------------------------------
    // Get master compliances
    //-----------------------------------
    const masters = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].compliance.findMany({
        where: {
            is_recurring_master: true
        }
    });
    for (const m of masters){
        //-----------------------------------
        // Check already exists
        //-----------------------------------
        const exists = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].compliance.findFirst({
            where: {
                parent_id: m.id,
                period_month: month,
                period_year: year
            }
        });
        if (exists) continue;
        //-----------------------------------
        // Resolve DRAFT status for company
        //-----------------------------------
        const status_id = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedStatuses$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["ensureStatusExists"])(m.company_id, "COMPLIANCE");
        //-----------------------------------
        // Create new instance
        //-----------------------------------
        const due_date = new Date(year, month - 1, m.due_day ?? 1);
        const newRecord = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].compliance.create({
            data: {
                company_id: m.company_id,
                name: `${m.name} - ${month}/${year}`,
                template_id: m.template_id,
                department_id: m.department_id,
                function_id: m.function_id,
                assigned_user_id: m.assigned_user_id,
                start_date: today,
                due_date,
                period_month: month,
                period_year: year,
                status: "DRAFT",
                status_id,
                parent_id: m.id,
                current_level: 0
            }
        });
        //-----------------------------------
        // Copy approval matrix
        //-----------------------------------
        const approvals = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].complianceApprovalLevel.findMany({
            where: {
                compliance_id: m.id
            }
        });
        for (const a of approvals){
            await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].complianceApprovalLevel.create({
                data: {
                    compliance_id: newRecord.id,
                    approver_id: a.approver_id,
                    level: a.level,
                    status: "PENDING"
                }
            });
        }
        console.log("[generator] Created:", newRecord.name);
    }
}
}),
"[project]/lib/overdue.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "runOverdueCheck",
    ()=>runOverdueCheck
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [instrumentation] (ecmascript)");
;
async function runOverdueCheck() {
    const today = new Date();
    //-------------------------------------
    // Compliance
    //-------------------------------------
    await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].compliance.updateMany({
        where: {
            due_date: {
                lt: today
            },
            status: {
                in: [
                    "DRAFT",
                    "PENDING",
                    "SUBMITTED"
                ]
            }
        },
        data: {
            status: "OVERDUE"
        }
    });
    //-------------------------------------
    // AMC
    //-------------------------------------
    await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].aMC.updateMany({
        where: {
            due_date: {
                lt: today
            },
            status: {
                in: [
                    "DRAFT",
                    "PENDING",
                    "SUBMITTED"
                ]
            }
        },
        data: {
            status: "OVERDUE"
        }
    });
    console.log("[overdue] Overdue check completed");
}
}),
"[externals]/events [external] (events, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("events", () => require("events"));

module.exports = mod;
}),
"[externals]/url [external] (url, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("url", () => require("url"));

module.exports = mod;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/http [external] (http, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("http", () => require("http"));

module.exports = mod;
}),
"[externals]/https [external] (https, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("https", () => require("https"));

module.exports = mod;
}),
"[externals]/zlib [external] (zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("zlib", () => require("zlib"));

module.exports = mod;
}),
"[externals]/stream [external] (stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}),
"[externals]/net [external] (net, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("net", () => require("net"));

module.exports = mod;
}),
"[externals]/dns [external] (dns, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("dns", () => require("dns"));

module.exports = mod;
}),
"[externals]/os [external] (os, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("os", () => require("os"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/tls [external] (tls, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("tls", () => require("tls"));

module.exports = mod;
}),
"[externals]/child_process [external] (child_process, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("child_process", () => require("child_process"));

module.exports = mod;
}),
"[project]/lib/smtp-crypto.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "decryptPassword",
    ()=>decryptPassword,
    "encryptPassword",
    ()=>encryptPassword
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/crypto [external] (crypto, cjs)");
;
const ALGORITHM = "aes-256-cbc";
function getKey() {
    const secret = process.env.JWT_SECRET ?? "fallback-smtp-encryption-secret!!";
    return __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].scryptSync(secret, "smtp-config-salt", 32);
}
function encryptPassword(plain) {
    const iv = __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].randomBytes(16);
    const key = getKey();
    const cipher = __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(plain, "utf8"),
        cipher.final()
    ]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
}
function decryptPassword(stored) {
    try {
        const [ivHex, encHex] = stored.split(":");
        const iv = Buffer.from(ivHex, "hex");
        const key = getKey();
        const decipher = __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].createDecipheriv(ALGORITHM, key, iv);
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(encHex, "hex")),
            decipher.final()
        ]);
        return decrypted.toString("utf8");
    } catch  {
        return "";
    }
}
}),
"[project]/lib/email.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "sendEmail",
    ()=>sendEmail
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$nodemailer$2f$lib$2f$nodemailer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/nodemailer/lib/nodemailer.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$smtp$2d$crypto$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/smtp-crypto.ts [instrumentation] (ecmascript)");
;
;
;
async function sendEmail(to, subject, text) {
    const config = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].smtpConfig.findFirst({
        where: {
            is_active: true
        }
    });
    if (!config) {
        console.log("[email] SMTP not configured");
        return;
    }
    const transporter = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$nodemailer$2f$lib$2f$nodemailer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["default"].createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.username,
            pass: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$smtp$2d$crypto$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["decryptPassword"])(config.password)
        }
    });
    await transporter.sendMail({
        from: config.from_email,
        to,
        subject,
        text
    });
}
}),
"[project]/lib/email-template.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "resolveEmailContent",
    ()=>resolveEmailContent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [instrumentation] (ecmascript)");
;
function interpolate(template, vars) {
    return template.replace(/\{\{user_name\}\}/g, vars.user_name ?? "").replace(/\{\{compliance_name\}\}/g, vars.compliance_name ?? "").replace(/\{\{due_date\}\}/g, vars.due_date ?? "");
}
async function resolveEmailContent(type, companyId, vars) {
    const tpl = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].emailTemplate.findUnique({
        where: {
            company_id_type: {
                company_id: companyId,
                type
            }
        }
    });
    if (!tpl) return null;
    return {
        subject: interpolate(tpl.subject, vars),
        body: interpolate(tpl.body, vars)
    };
}
}),
"[project]/lib/notification.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "notifyUser",
    ()=>notifyUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$email$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/email.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$email$2d$template$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/email-template.ts [instrumentation] (ecmascript)");
;
;
;
async function notifyUser(userId, title, message, templateOptions, recordId, recordModule) {
    //-------------------------------------
    // Save in DB
    //-------------------------------------
    const user = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].user.findUnique({
        where: {
            id: userId
        }
    });
    await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].notification.create({
        data: {
            user_id: userId,
            title,
            message,
            type: "REMINDER",
            record_id: recordId ?? null,
            record_module: recordModule ?? null
        }
    });
    //-------------------------------------
    // Send Email
    //-------------------------------------
    if (user?.email) {
        if (templateOptions) {
            const resolved = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$email$2d$template$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveEmailContent"])(templateOptions.type, templateOptions.companyId, templateOptions.vars);
            if (resolved) {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$email$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["sendEmail"])(user.email, resolved.subject, resolved.body);
                return;
            }
        }
        // Fallback to static text if no template found
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$email$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["sendEmail"])(user.email, title, message);
    }
}
}),
"[project]/lib/reminder.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "runReminderEngine",
    ()=>runReminderEngine
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$notification$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/notification.ts [instrumentation] (ecmascript)");
;
;
async function runReminderEngine() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    //-------------------------------------
    // Compliance reminders
    //-------------------------------------
    const compliances = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].compliance.findMany({
        where: {
            status: {
                in: [
                    "DRAFT",
                    "SUBMITTED"
                ]
            },
            reminder_days: {
                not: null
            },
            due_date: {
                not: undefined
            }
        },
        include: {
            assignedUser: {
                select: {
                    id: true,
                    name: true
                }
            },
            approval_levels: {
                where: {
                    status: "PENDING"
                },
                select: {
                    approver_id: true
                }
            }
        }
    });
    // Collect all approver IDs for compliance
    const complianceApproverIds = Array.from(new Set(compliances.flatMap((c)=>c.approval_levels.map((l)=>l.approver_id))));
    const complianceApproverMap = complianceApproverIds.length ? Object.fromEntries((await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].user.findMany({
        where: {
            id: {
                in: complianceApproverIds
            }
        },
        select: {
            id: true,
            name: true
        }
    })).map((u)=>[
            u.id,
            u.name ?? ""
        ])) : {};
    for (const c of compliances){
        if (!c.due_date || c.reminder_days == null) continue;
        const reminderDate = new Date(c.due_date);
        reminderDate.setDate(reminderDate.getDate() - c.reminder_days);
        reminderDate.setHours(0, 0, 0, 0);
        if (reminderDate.getTime() !== today.getTime()) continue;
        const dueDateStr = c.due_date.toDateString();
        // Notify assigned user
        if (c.assigned_user_id) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$notification$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifyUser"])(c.assigned_user_id, "Compliance Reminder", `Your compliance "${c.name}" is due on ${dueDateStr}. Please take action.`, {
                type: "REMINDER",
                companyId: c.company_id,
                vars: {
                    user_name: c.assignedUser?.name ?? "",
                    compliance_name: c.name,
                    due_date: dueDateStr
                }
            }, c.id, "COMPLIANCE");
        }
        // Notify pending approvers
        for (const level of c.approval_levels){
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$notification$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifyUser"])(level.approver_id, "Compliance Approval Reminder", `The compliance "${c.name}" is due on ${dueDateStr} and is awaiting your approval.`, {
                type: "APPROVAL",
                companyId: c.company_id,
                vars: {
                    user_name: complianceApproverMap[level.approver_id] ?? "",
                    compliance_name: c.name,
                    due_date: dueDateStr
                }
            }, c.id, "COMPLIANCE");
        }
        console.log(`[reminder] Compliance reminder sent: ${c.name}`);
    }
    //-------------------------------------
    // AMC reminders
    //-------------------------------------
    const amcs = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].aMC.findMany({
        where: {
            status: {
                in: [
                    "DRAFT",
                    "SUBMITTED"
                ]
            },
            reminder_days: {
                not: null
            },
            due_date: {
                not: null
            }
        },
        include: {
            assignedUser: {
                select: {
                    id: true,
                    name: true
                }
            },
            approval_levels: {
                where: {
                    status: "PENDING"
                },
                include: {
                    approver: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            }
        }
    });
    for (const a of amcs){
        if (!a.due_date || a.reminder_days == null) continue;
        const reminderDate = new Date(a.due_date);
        reminderDate.setDate(reminderDate.getDate() - a.reminder_days);
        reminderDate.setHours(0, 0, 0, 0);
        if (reminderDate.getTime() !== today.getTime()) continue;
        const dueDateStr = a.due_date.toDateString();
        // Notify assigned user
        if (a.assigned_user_id) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$notification$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifyUser"])(a.assigned_user_id, "AMC Reminder", `Your AMC record "${a.name}" is due on ${dueDateStr}. Please take action.`, {
                type: "REMINDER",
                companyId: a.company_id,
                vars: {
                    user_name: a.assignedUser?.name ?? "",
                    compliance_name: a.name,
                    due_date: dueDateStr
                }
            }, a.id, "AMC");
        }
        // Notify pending approvers
        for (const level of a.approval_levels){
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$notification$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifyUser"])(level.approver_id, "AMC Approval Reminder", `The AMC record "${a.name}" is due on ${dueDateStr} and is awaiting your approval.`, {
                type: "APPROVAL",
                companyId: a.company_id,
                vars: {
                    user_name: level.approver?.name ?? "",
                    compliance_name: a.name,
                    due_date: dueDateStr
                }
            }, a.id, "AMC");
        }
        console.log(`[reminder] AMC reminder sent: ${a.name}`);
    }
}
}),
"[project]/lib/escalation.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "runEscalationCheck",
    ()=>runEscalationCheck
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/prisma.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$notification$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/notification.ts [instrumentation] (ecmascript)");
;
;
async function runEscalationCheck() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    //-------------------------------------
    // Compliance escalation
    //-------------------------------------
    const compliances = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].compliance.findMany({
        where: {
            status: "OVERDUE",
            escalation_days: {
                not: null
            },
            due_date: {
                not: undefined
            }
        },
        select: {
            id: true,
            name: true,
            company_id: true,
            due_date: true,
            escalation_days: true
        }
    });
    for (const c of compliances){
        if (!c.due_date || c.escalation_days == null) continue;
        const escalationDate = new Date(c.due_date);
        escalationDate.setDate(escalationDate.getDate() + c.escalation_days);
        escalationDate.setHours(0, 0, 0, 0);
        if (today < escalationDate) continue;
        // Notify all admins in the company
        const admins = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].user.findMany({
            where: {
                company_id: c.company_id,
                role: {
                    in: [
                        "ADMIN",
                        "SUPER_ADMIN"
                    ]
                },
                is_active: true
            },
            select: {
                id: true
            }
        });
        for (const admin of admins){
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$notification$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifyUser"])(admin.id, "Compliance Escalation Alert", `Compliance "${c.name}" is overdue beyond the escalation limit of ${c.escalation_days} day(s). Immediate attention required.`, undefined, c.id, "COMPLIANCE");
        }
        console.log(`[escalation] Compliance escalation triggered: ${c.name}`);
    }
    //-------------------------------------
    // AMC escalation
    //-------------------------------------
    const amcs = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].aMC.findMany({
        where: {
            status: "OVERDUE",
            escalation_days: {
                not: null
            },
            due_date: {
                not: null
            }
        },
        select: {
            id: true,
            name: true,
            company_id: true,
            due_date: true,
            escalation_days: true
        }
    });
    for (const a of amcs){
        if (!a.due_date || a.escalation_days == null) continue;
        const escalationDate = new Date(a.due_date);
        escalationDate.setDate(escalationDate.getDate() + a.escalation_days);
        escalationDate.setHours(0, 0, 0, 0);
        if (today < escalationDate) continue;
        // Notify all admins in the company
        const admins = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$prisma$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["prisma"].user.findMany({
            where: {
                company_id: a.company_id,
                role: {
                    in: [
                        "ADMIN",
                        "SUPER_ADMIN"
                    ]
                },
                is_active: true
            },
            select: {
                id: true
            }
        });
        for (const admin of admins){
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$notification$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifyUser"])(admin.id, "AMC Escalation Alert", `AMC record "${a.name}" is overdue beyond the escalation limit of ${a.escalation_days} day(s). Immediate attention required.`, undefined, a.id, "AMC");
        }
        console.log(`[escalation] AMC escalation triggered: ${a.name}`);
    }
}
}),
"[project]/lib/cron.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "startCron",
    ()=>startCron
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$2d$cron__$5b$external$5d$__$28$node$2d$cron$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$node$2d$cron$29$__ = __turbopack_context__.i("[externals]/node-cron [external] (node-cron, esm_import, [project]/node_modules/node-cron)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$generator$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/generator.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$overdue$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/overdue.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$reminder$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/reminder.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$escalation$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/escalation.ts [instrumentation] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$externals$5d2f$node$2d$cron__$5b$external$5d$__$28$node$2d$cron$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$node$2d$cron$29$__
]);
[__TURBOPACK__imported__module__$5b$externals$5d2f$node$2d$cron__$5b$external$5d$__$28$node$2d$cron$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$node$2d$cron$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
function startCron() {
    __TURBOPACK__imported__module__$5b$externals$5d2f$node$2d$cron__$5b$external$5d$__$28$node$2d$cron$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$node$2d$cron$29$__["default"].schedule("0 1 * * *", async ()=>{
        console.log("Running daily automation...");
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$generator$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["runComplianceGenerator"])();
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$overdue$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["runOverdueCheck"])();
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$reminder$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["runReminderEngine"])();
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$escalation$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["runEscalationCheck"])();
        console.log("Automation complete");
    });
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__e105907e._.js.map
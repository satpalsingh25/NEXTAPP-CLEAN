"use client";

import { Fragment } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldHalf,
  Eye,
  Minus,
  Check,
  Users,
  FileText,
  Wrench,
  UserCog,
  LayoutTemplate,
  BadgeCheck,
  BarChart3,
  Crown,
  Shield,
} from "lucide-react";

// ─── System Role Definitions ──────────────────────────────────────────────────

type PermLevel = "full" | "manage" | "view" | "own" | "none";

interface RolePermissions {
  compliance: PermLevel;
  amc: PermLevel;
  users: PermLevel;
  templates: PermLevel;
  approval: PermLevel;
  reports: PermLevel;
}

interface SystemRole {
  key: string;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  tier: "system" | "admin" | "operational" | "view";
  permissions: RolePermissions;
}

const SYSTEM_ROLES: SystemRole[] = [
  {
    key: "SUPER_ADMIN",
    label: "Super Admin",
    description: "Unrestricted access to all modules, settings, and multi-tenant management.",
    color: "text-violet-700",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    iconColor: "text-violet-600",
    tier: "system",
    permissions: {
      compliance: "full",
      amc: "full",
      users: "full",
      templates: "full",
      approval: "full",
      reports: "full",
    },
  },
  {
    key: "ADMIN",
    label: "Admin",
    description: "Full access within the company tenant. Manages users, templates, and workflows.",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    iconColor: "text-blue-600",
    tier: "admin",
    permissions: {
      compliance: "full",
      amc: "full",
      users: "full",
      templates: "full",
      approval: "full",
      reports: "full",
    },
  },
  {
    key: "MANAGER",
    label: "Manager",
    description: "Manages compliance and AMC records. Can configure templates and run reports.",
    color: "text-indigo-700",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    iconColor: "text-indigo-600",
    tier: "operational",
    permissions: {
      compliance: "manage",
      amc: "manage",
      users: "view",
      templates: "manage",
      approval: "manage",
      reports: "full",
    },
  },
  {
    key: "APPROVER",
    label: "Approver",
    description: "Reviews and approves or rejects submitted compliance and AMC records at assigned levels.",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    iconColor: "text-emerald-600",
    tier: "operational",
    permissions: {
      compliance: "view",
      amc: "view",
      users: "none",
      templates: "none",
      approval: "full",
      reports: "view",
    },
  },
  {
    key: "CHECKER",
    label: "Checker",
    description: "Reviews records for accuracy before escalation. Read-only across modules.",
    color: "text-cyan-700",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
    iconColor: "text-cyan-600",
    tier: "operational",
    permissions: {
      compliance: "view",
      amc: "view",
      users: "none",
      templates: "none",
      approval: "none",
      reports: "view",
    },
  },
  {
    key: "USER",
    label: "User",
    description: "Creates and submits compliance and AMC records. Views own submissions only.",
    color: "text-slate-700",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    iconColor: "text-slate-500",
    tier: "operational",
    permissions: {
      compliance: "own",
      amc: "own",
      users: "none",
      templates: "none",
      approval: "none",
      reports: "own",
    },
  },
  {
    key: "CEO",
    label: "CEO",
    description: "Executive read-only access across all modules. Full access to reports and dashboards.",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    iconColor: "text-amber-600",
    tier: "view",
    permissions: {
      compliance: "view",
      amc: "view",
      users: "view",
      templates: "view",
      approval: "view",
      reports: "full",
    },
  },
];

// ─── Column definitions ───────────────────────────────────────────────────────

interface ModuleColumn {
  key: keyof RolePermissions;
  label: string;
  icon: React.ReactNode;
}

const COLUMNS: ModuleColumn[] = [
  { key: "compliance", label: "Compliance", icon: <FileText size={14} /> },
  { key: "amc",        label: "AMC",        icon: <Wrench size={14} /> },
  { key: "users",      label: "Users",      icon: <UserCog size={14} /> },
  { key: "templates",  label: "Templates",  icon: <LayoutTemplate size={14} /> },
  { key: "approval",   label: "Approval",   icon: <BadgeCheck size={14} /> },
  { key: "reports",    label: "Reports",    icon: <BarChart3 size={14} /> },
];

// ─── Permission cell rendering ────────────────────────────────────────────────

const PERM_CONFIG: Record<PermLevel, { label: string; icon: React.ReactNode; cell: string; text: string }> = {
  full:   { label: "Full",    icon: <Check size={13} strokeWidth={2.5} />, cell: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "text-emerald-700" },
  manage: { label: "Manage",  icon: <ShieldHalf size={13} />,              cell: "bg-blue-50 text-blue-700 border-blue-200",           text: "text-blue-700" },
  view:   { label: "View",    icon: <Eye size={13} />,                     cell: "bg-slate-50 text-slate-600 border-slate-200",        text: "text-slate-500" },
  own:    { label: "Own",     icon: <Users size={13} />,                   cell: "bg-amber-50 text-amber-700 border-amber-200",        text: "text-amber-700" },
  none:   { label: "—",       icon: <Minus size={13} />,                   cell: "bg-transparent text-slate-300 border-transparent",  text: "text-slate-300" },
};

function PermCell({ level }: { level: PermLevel }) {
  const cfg = PERM_CONFIG[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${cfg.cell}`}
      data-testid={`perm-${level}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Role Badge ───────────────────────────────────────────────────────────────

function RoleIcon({ roleKey }: { roleKey: string }) {
  if (roleKey === "SUPER_ADMIN") return <ShieldAlert size={15} />;
  if (roleKey === "ADMIN")       return <ShieldCheck size={15} />;
  if (roleKey === "CEO")         return <Crown size={15} />;
  if (roleKey === "MANAGER")     return <Shield size={15} />;
  if (roleKey === "APPROVER")    return <BadgeCheck size={15} />;
  if (roleKey === "CHECKER")     return <Eye size={15} />;
  return <Users size={15} />;
}

function RoleBadge({ role }: { role: SystemRole }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${role.bgColor} ${role.color} ${role.borderColor}`}
      data-testid={`badge-${role.key}`}
    >
      <span className={role.iconColor}><RoleIcon roleKey={role.key} /></span>
      {role.label}
    </span>
  );
}

// ─── Tier separator ───────────────────────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  system:      "System Level",
  admin:       "Administration",
  operational: "Operational",
  view:        "Executive / View",
};

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm font-medium text-slate-700 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RoleMasterPage() {
  const totalFull = SYSTEM_ROLES.flatMap((r) =>
    Object.values(r.permissions).filter((p) => p === "full")
  ).length;

  return (
    <div className="space-y-8 max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Role Master</h1>
          <p className="text-sm text-slate-500 mt-1">
            System-defined roles and their permissions across all modules. Roles are immutable constants.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full border border-slate-200">
          <ShieldCheck size={13} />
          System Constants · No DB
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Roles" value={SYSTEM_ROLES.length} sub="System-defined" />
        <StatCard label="Modules Covered" value={COLUMNS.length} sub="Permission axes" />
        <StatCard label="Full-Access Grants" value={totalFull} sub="Across all roles" />
        <StatCard label="Operational Roles" value={SYSTEM_ROLES.filter(r => r.tier === "operational").length} sub="Day-to-day users" />
      </div>

      {/* Role Cards Grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">Role Definitions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {SYSTEM_ROLES.map((role) => (
            <div
              key={role.key}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow"
              data-testid={`card-role-${role.key}`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className={`p-2 rounded-lg ${role.bgColor}`}>
                  <span className={role.iconColor}><RoleIcon roleKey={role.key} /></span>
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${role.bgColor} ${role.color} ${role.borderColor}`}>
                  {TIER_LABELS[role.tier]}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">{role.label}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{role.description}</p>

              {/* Mini permission dots */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {COLUMNS.map((col) => {
                  const level = role.permissions[col.key];
                  const cfg = PERM_CONFIG[level];
                  return level !== "none" ? (
                    <span
                      key={col.key}
                      title={`${col.label}: ${cfg.label}`}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${cfg.cell}`}
                    >
                      {col.icon}
                      {col.label}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">Permissions Matrix</h2>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Legend */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Legend:</span>
            {(Object.entries(PERM_CONFIG) as [PermLevel, typeof PERM_CONFIG[PermLevel]][]).map(([level, cfg]) => (
              <span key={level} className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
                {cfg.icon} {cfg.label}
              </span>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-48">
                    Role
                  </th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-slate-400">{col.icon}</span>
                        {col.label}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SYSTEM_ROLES.map((role, idx) => {
                  const prevTier = idx > 0 ? SYSTEM_ROLES[idx - 1].tier : null;
                  const showDivider = prevTier && prevTier !== role.tier;
                  return (
                    <Fragment key={role.key}>
                      {showDivider && (
                        <tr>
                          <td colSpan={COLUMNS.length + 1} className="px-6 py-2 bg-slate-50 border-y border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {TIER_LABELS[role.tier]}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr
                        className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                        data-testid={`row-role-${role.key}`}
                      >
                        {/* Role cell */}
                        <td className="px-6 py-4">
                          <RoleBadge role={role} />
                        </td>

                        {/* Permission cells */}
                        {COLUMNS.map((col) => (
                          <td key={col.key} className="px-4 py-4 text-center">
                            <PermCell level={role.permissions[col.key]} />
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-slate-400 text-center pb-4">
        Role definitions are system constants defined in the application source. Contact your system administrator to request role adjustments.
      </p>
    </div>
  );
}

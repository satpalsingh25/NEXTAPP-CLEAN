"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  ShieldCheck,
  Wrench,
  Settings,
  FilePlus,
  FileText,
  GitBranch,
  Users,
  Building2,
  Shield,
  Group,
  FunctionSquare,
  Building,
  Globe,
  ChevronRight,
  ChevronLeft,
  ListChecks,
  BadgeCheck,
  Mail,
  FileCode,
  HardDrive,
  FolderOpen,
  ScrollText,
  Database,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useBranding } from "@/context/BrandingContext";

type NavChild = {
  name: string;
  href: string;
  icon: React.ElementType;
  perm?: "create" | "templates" | "matrix" | "pending" | "super_admin";
  group?: string;
};

type NavModule = {
  name: string;
  icon: React.ElementType;
  key: string;
  basePath: string;
  perm?: "admin";
  children: NavChild[];
};

const ALL_MODULES: NavModule[] = [
  {
    name: "Compliance",
    icon: ShieldCheck,
    key: "compliance",
    basePath: "/compliance",
    children: [
      { name: "My Tasks",          href: "/compliance/my-tasks",          icon: ListChecks },
      { name: "Compliances",       href: "/compliance",                   icon: LayoutDashboard },
      { name: "Create Compliance", href: "/compliance/create",            icon: FilePlus,   perm: "create" },
      { name: "Templates",         href: "/compliance/templates",         icon: FileText,   perm: "templates" },
      { name: "Approval Matrix",   href: "/compliance/approval-matrix",   icon: GitBranch,  perm: "matrix" },
    ],
  },
  {
    name: "AMC",
    icon: Wrench,
    key: "amc",
    basePath: "/amc",
    children: [
      { name: "My Tasks",    href: "/amc/my-tasks",        icon: ListChecks },
      { name: "AMC",         href: "/amc",                 icon: LayoutDashboard },
      { name: "Create AMC",  href: "/amc/create",          icon: FilePlus,  perm: "create" },
      { name: "Templates",   href: "/amc/templates",       icon: FileText,  perm: "templates" },
      { name: "Approval Matrix", href: "/amc/approval-matrix", icon: GitBranch, perm: "matrix" },
    ],
  },
  {
    name: "DMS",
    icon: HardDrive,
    key: "dms",
    basePath: "/dms",
    children: [
      { name: "My Files",    href: "/dms/my-files",    icon: FolderOpen },
      { name: "Team Folder", href: "/dms/team-folder", icon: FolderOpen },
    ],
  },
  {
    name: "Admin",
    icon: Settings,
    key: "admin",
    basePath: "/admin",
    perm: "admin",
    children: [
      { name: "Users",       href: "/admin/users",       icon: Users },
      { name: "Companies",   href: "/admin/companies",   icon: Building2, perm: "super_admin" },
      { name: "Roles",       href: "/admin/roles",       icon: Shield },
      { name: "Groups",      href: "/admin/groups",      icon: Group },
      { name: "Functions",   href: "/admin/functions",   icon: FunctionSquare },
      { name: "Departments", href: "/admin/departments", icon: Building },
      { name: "Countries",   href: "/admin/countries",   icon: Globe },

      { name: "General",           href: "/admin/companies",                    icon: Building2,  perm: "super_admin", group: "Company Settings" },
      { name: "Branding",          href: "/admin/company-settings/branding",    icon: Building2,                       group: "Company Settings" },
      { name: "DMS Settings",      href: "/admin/dms-settings",                 icon: HardDrive,                       group: "Company Settings" },
      { name: "Storage Providers", href: "/admin/storage-providers",            icon: Database,                        group: "Company Settings" },

      { name: "SMTP Settings",     href: "/admin/smtp",            icon: Mail,     group: "Mail Settings" },
      { name: "Template Settings", href: "/admin/email-templates", icon: FileCode, group: "Mail Settings" },

      { name: "Audit Logs",              href: "/admin/audit-logs",              icon: ScrollText,  group: "System" },
      { name: "Authentication Settings", href: "/admin/authentication-settings", icon: ShieldCheck, group: "System" },
    ],
  },
];

function buildPermissions(role: string) {
  const isAdmin   = ["ADMIN", "SUPER_ADMIN"].includes(role);
  const isManager = isAdmin || role === "MANAGER";
  const isApprover = role === "APPROVER";
  const isUser    = role === "USER";
  return {
    admin:       isAdmin,
    super_admin: role === "SUPER_ADMIN",
    create:      isManager,
    templates:   isAdmin,
    matrix:      isAdmin,
    pending:     isAdmin || isApprover,
    topDashboard: !isUser,
  } as Record<string, boolean>;
}

const KEY_TO_MODULE_NAME: Record<string, string> = {
  compliance: "COMPLIANCE",
  amc:        "AMC",
  dms:        "DMS",
};

type ModuleFlag = { name: string; enabled: boolean };

export default function Sidebar() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const { user }     = useAuth();
  const { branding } = useBranding();
  const role         = user?.role ?? "USER";
  const can          = useMemo(() => buildPermissions(role), [role]);

  const [collapsed, setCollapsed] = useState(false);
  const [moduleFlags, setModuleFlags] = useState<ModuleFlag[] | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved === "true") setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    fetch("/api/modules")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ModuleFlag[]) => setModuleFlags(Array.isArray(data) ? data : []))
      .catch(() => setModuleFlags([]));
  }, []);

  function isModuleEnabled(navKey: string): boolean {
    const moduleName = KEY_TO_MODULE_NAME[navKey];
    if (!moduleName) return true;
    if (moduleFlags === null) return false;
    const flag = moduleFlags.find((m) => m.name === moduleName);
    return flag ? flag.enabled : true;
  }

  const visibleModules = useMemo(
    () =>
      ALL_MODULES
        .filter((m) => !m.perm || can[m.perm])
        .filter((m) => isModuleEnabled(m.key))
        .map((m) => ({
          ...m,
          children: m.children.filter((c) => !c.perm || can[c.perm]),
        }))
        .filter((m) => m.children.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can, moduleFlags]
  );

  const initialOpen = useMemo(
    () =>
      visibleModules.reduce((acc, m) => {
        acc[m.key] = pathname?.startsWith(m.basePath) ?? false;
        return acc;
      }, {} as Record<string, boolean>),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [open, setOpen] = useState<Record<string, boolean>>(initialOpen);

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      visibleModules.forEach((m) => {
        if (pathname?.startsWith(m.basePath)) next[m.key] = true;
      });
      return next;
    });
  }, [pathname, visibleModules]);

  const toggle = (key: string) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  function isLinkActive(href: string): boolean {
    const [hrefPath, hrefQuery] = href.split("?");
    if (!hrefQuery) return pathname === hrefPath;
    const params = new URLSearchParams(hrefQuery);
    if (pathname !== hrefPath) return false;
    for (const [k, v] of params.entries()) {
      if (searchParams?.get(k) !== v) return false;
    }
    return true;
  }

  const activeLinkCls =
    "bg-blue-600/20 text-blue-300 font-medium border border-blue-600/25";
  const defaultLinkCls =
    "text-slate-400 hover:bg-slate-800/80 hover:text-slate-100";

  return (
    <aside
      className={`
        ${collapsed ? "w-16" : "w-60"}
        transition-[width] duration-300 ease-in-out
        bg-gradient-to-b from-slate-900 to-slate-950
        text-slate-100 h-screen sticky top-0
        hidden md:flex flex-col
        border-r border-slate-800/60
        shrink-0 overflow-hidden
      `}
    >
      {/* Brand header */}
      <div className="h-14 flex items-center px-4 border-b border-slate-800/60 overflow-hidden shrink-0">
        {collapsed ? (
          <div className="w-full flex justify-center">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">
                {(branding.app_name || "C").charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">
                {(branding.app_name || "C").charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="font-semibold text-sm tracking-tight text-white truncate">
              {branding.app_name || "Compliance & AMC"}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {/* Dashboard */}
        <Link
          href="/dashboard"
          title={collapsed ? "Dashboard" : undefined}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
            isLinkActive("/dashboard") ? activeLinkCls : defaultLinkCls
          } ${collapsed ? "justify-center px-2" : ""}`}
        >
          <LayoutDashboard size={17} className="shrink-0" />
          {!collapsed && <span>Dashboard</span>}
        </Link>

        {/* Modules */}
        {visibleModules.map((mod) => {
          const isModuleActive = pathname?.startsWith(mod.basePath);
          const isExpanded     = open[mod.key];

          if (collapsed) {
            return (
              <button
                key={mod.key}
                onClick={toggleCollapsed}
                title={mod.name}
                className={`w-full flex justify-center px-2 py-2 rounded-lg text-sm transition-all duration-150 ${
                  isModuleActive ? activeLinkCls : defaultLinkCls
                }`}
              >
                <mod.icon size={17} className="shrink-0" />
              </button>
            );
          }

          return (
            <div key={mod.key}>
              <button
                onClick={() => toggle(mod.key)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                  isModuleActive
                    ? "text-white font-medium"
                    : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
                }`}
              >
                <mod.icon size={17} className="shrink-0" />
                <span className="flex-1 text-left">{mod.name}</span>
                <ChevronRight
                  size={13}
                  className={`shrink-0 transition-transform duration-200 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="mt-0.5 ml-2 pl-3.5 border-l border-slate-700/50 space-y-0.5 py-1">
                  {(() => {
                    const blocks: { group: string | null; items: NavChild[] }[] = [];
                    mod.children.forEach((c) => {
                      const g    = c.group ?? null;
                      const last = blocks[blocks.length - 1];
                      if (last && last.group === g) last.items.push(c);
                      else blocks.push({ group: g, items: [c] });
                    });
                    return blocks.map((block, idx) => (
                      <div key={`${block.group ?? "_"}-${idx}`} className={block.group ? "mt-2" : ""}>
                        {block.group && (
                          <div className="px-2.5 pt-1 pb-0.5 text-[10px] uppercase tracking-wider text-slate-600 font-semibold">
                            {block.group}
                          </div>
                        )}
                        {block.items.map((child, i) => (
                          <Link
                            key={`${child.href}-${child.name}-${i}`}
                            href={child.href}
                            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-all duration-150 ${
                              isLinkActive(child.href)
                                ? activeLinkCls
                                : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
                            }`}
                          >
                            <child.icon size={14} className="shrink-0" />
                            <span>{child.name}</span>
                          </Link>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Company badge */}
      {!collapsed && user && user.role !== "SUPER_ADMIN" && user.company_name && (
        <div className="px-3 py-2 border-t border-slate-800/60 shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-2 bg-slate-800/60 rounded-lg">
            <BadgeCheck size={13} className="text-blue-400 shrink-0" />
            <span className="text-xs text-slate-300 truncate font-medium">
              {user.company_name}
            </span>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="px-3 py-3 border-t border-slate-800/60 shrink-0">
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 rounded-lg transition-all duration-150 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {collapsed ? (
            <ChevronRight size={15} />
          ) : (
            <>
              <ChevronLeft size={15} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

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
  ListChecks,
  BadgeCheck,
  Mail,
  FileCode,
  Cloud,
  HardDrive,
  FolderOpen,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type NavChild = {
  name: string;
  href: string;
  icon: React.ElementType;
  perm?: "create" | "templates" | "matrix" | "pending" | "super_admin";
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
      { name: "My Tasks",           href: "/compliance/my-tasks",                   icon: ListChecks },
      { name: "Compliances",        href: "/compliance",                            icon: LayoutDashboard },
      { name: "Create Compliance",  href: "/compliance/create",                     icon: FilePlus,   perm: "create" },
      { name: "Templates",          href: "/compliance/templates",                  icon: FileText,   perm: "templates" },
      { name: "Approval Matrix",    href: "/compliance/approval-matrix",            icon: GitBranch,  perm: "matrix" },
    ],
  },
  {
    name: "AMC",
    icon: Wrench,
    key: "amc",
    basePath: "/amc",
    children: [
      { name: "My Tasks",          href: "/amc/my-tasks",                          icon: ListChecks },
      { name: "AMC",               href: "/amc",                                   icon: LayoutDashboard },
      { name: "Create AMC",        href: "/amc/create",                            icon: FilePlus,   perm: "create" },
      { name: "Templates",         href: "/amc/templates",                         icon: FileText,   perm: "templates" },
      { name: "Approval Matrix",   href: "/amc/approval-matrix",                   icon: GitBranch,  perm: "matrix" },
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
      { name: "Users",        href: "/admin/users",        icon: Users },
      { name: "Companies",     href: "/admin/companies",    icon: Building2, perm: "super_admin" },
      { name: "Roles",         href: "/admin/roles",        icon: Shield },
      { name: "Groups",        href: "/admin/groups",       icon: Group },
      { name: "Functions",     href: "/admin/functions",    icon: FunctionSquare },
      { name: "Departments",   href: "/admin/departments",  icon: Building },
      { name: "Countries",     href: "/admin/countries",    icon: Globe },
      { name: "SMTP Settings",       href: "/admin/smtp",             icon: Mail },
      { name: "Email Templates",   href: "/admin/email-templates",  icon: FileCode },
      { name: "SharePoint Config",  href: "/admin/sharepoint",       icon: Cloud },
      { name: "DMS Settings",      href: "/admin/dms-settings",     icon: HardDrive },
    ],
  },
];

function buildPermissions(role: string) {
  const isAdmin      = ["ADMIN", "SUPER_ADMIN"].includes(role);
  const isManager    = isAdmin || role === "MANAGER";
  const isApprover   = role === "APPROVER";
  const isUser       = role === "USER";
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

export default function Sidebar() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const { user }     = useAuth();
  const role         = user?.role ?? "USER";
  const can          = useMemo(() => buildPermissions(role), [role]);

  const visibleModules = useMemo(() =>
    ALL_MODULES
      .filter((m) => !m.perm || can[m.perm])
      .map((m) => ({
        ...m,
        children: m.children.filter((c) => !c.perm || can[c.perm]),
      }))
      .filter((m) => m.children.length > 0),
    [can]);

  const initialOpen = useMemo(() =>
    visibleModules.reduce((acc, m) => {
      acc[m.key] = pathname?.startsWith(m.basePath) ?? false;
      return acc;
    }, {} as Record<string, boolean>),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

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

  const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

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

  return (
    <aside className="w-60 bg-slate-900 text-slate-100 h-screen sticky top-0 hidden md:flex flex-col border-r border-slate-800 shrink-0">
      <div className="h-14 flex items-center px-5 border-b border-slate-800">
        <span className="font-bold text-base tracking-tight text-white">Compliance & AMC</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            isLinkActive("/dashboard")
              ? "bg-slate-700 text-white font-medium"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          }`}
        >
          <LayoutDashboard size={16} className="shrink-0" />
          <span>Dashboard</span>
        </Link>

        {visibleModules.map((mod) => {
          const isModuleActive = pathname?.startsWith(mod.basePath);
          const isExpanded     = open[mod.key];

          return (
            <div key={mod.key}>
              <button
                onClick={() => toggle(mod.key)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isModuleActive
                    ? "text-white font-medium"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                <mod.icon size={16} className="shrink-0" />
                <span className="flex-1 text-left">{mod.name}</span>
                <ChevronRight
                  size={14}
                  className={`shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                />
              </button>

              <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="mt-0.5 ml-2 pl-4 border-l border-slate-700 space-y-0.5 py-1">
                  {mod.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                        isLinkActive(child.href)
                          ? "bg-slate-700 text-white font-medium"
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                      }`}
                    >
                      <child.icon size={14} className="shrink-0" />
                      <span>{child.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {user && user.role !== "SUPER_ADMIN" && user.company_name && (
        <div className="px-4 py-3 border-t border-slate-800">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800 rounded-md">
            <BadgeCheck size={14} className="text-blue-400 shrink-0" />
            <span className="text-xs text-slate-300 truncate font-medium">{user.company_name}</span>
          </div>
        </div>
      )}

      <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-600 text-center">
        © 2024 AMC System
      </div>
    </aside>
  );
}

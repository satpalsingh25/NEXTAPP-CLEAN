"use client";

import { useAuth } from "@/context/AuthContext";
import { useBranding } from "@/context/BrandingContext";
import Link from "next/link";
import { LogOut, LogIn, UserCircle } from "lucide-react";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  const { user, loading, logout } = useAuth();
  const { branding } = useBranding();

  const hasLogo = !!branding.logo_base64;
  const logoSrc = branding.logo_base64 ?? "";
  const appName = branding.app_name || "Compliance & AMC";

  return (
    <header
      className="h-16 flex items-center justify-between px-6 sticky top-0 z-10 border-b"
      style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
    >
      <div className="hidden md:flex items-center gap-3">
        {hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt="Logo"
            className="h-8 max-w-[160px] object-contain"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>{appName}</span>
        )}
      </div>
      <div className="md:hidden font-bold" style={{ color: "var(--text)" }}>{appName}</div>

      <div className="flex items-center gap-2">
        <a
          href="/dashboard"
          className="px-3 py-1.5 text-sm rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          style={{ color: "var(--muted)" }}
        >
          Dashboard
        </a>
        <a
          href="/admin"
          className="px-3 py-1.5 text-sm rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          style={{ color: "var(--muted)" }}
        >
          Admin
        </a>

        <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />

        <ThemeToggle />

        {user && <NotificationBell />}

        {loading ? (
          <div className="h-4 w-24 rounded animate-pulse" style={{ background: "var(--border)" }} />
        ) : user ? (
          <>
            <div className="flex items-center gap-1.5 text-sm pl-1" style={{ color: "var(--muted)" }}>
              <UserCircle size={18} style={{ color: "var(--muted)" }} />
              <span className="hidden sm:inline">{user.email}</span>
              <span className="text-xs hidden sm:inline" style={{ color: "var(--muted)", opacity: 0.7 }}>
                ({user.role})
              </span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 border border-red-200 rounded-md hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30 transition-colors"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors"
            style={{ color: "var(--text)", borderColor: "var(--border)" }}
          >
            <LogIn size={14} />
            <span>Login</span>
          </Link>
        )}
      </div>
    </header>
  );
}

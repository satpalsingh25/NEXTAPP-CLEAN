"use client";

import { useAuth } from "@/context/AuthContext";
import { useBranding } from "@/context/BrandingContext";
import Link from "next/link";
import { LogOut, LogIn, UserCircle } from "lucide-react";
import NotificationBell from "./NotificationBell";

export default function Header() {
  const { user, loading, logout } = useAuth();
  const { branding } = useBranding();

  const hasLogo  = !!branding.logo_url;
  const logoSrc  = branding.logo_url ?? "";

  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-8 sticky top-0 z-10">
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
          <span className="text-slate-500 dark:text-slate-300 text-sm">Compliance &amp; AMC Management</span>
        )}
      </div>
      <div className="md:hidden font-bold text-slate-900 dark:text-slate-100">AMC System</div>

      <div className="flex items-center space-x-3">
        <a href="/dashboard" className="mr-2 text-sm text-slate-700 hover:text-slate-900 transition-colors">Dashboard</a>
        <a href="/admin" className="mr-2 text-sm text-slate-700 hover:text-slate-900 transition-colors">Admin</a>

        {user && <NotificationBell />}

        {loading ? (
          <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
        ) : user ? (
          <>
            <div className="flex items-center space-x-2 text-sm text-slate-700">
              <UserCircle size={20} className="text-slate-400" />
              <span className="hidden sm:inline">{user.email}</span>
              <span className="text-xs text-slate-400 hidden sm:inline">({user.role})</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="flex items-center space-x-1 px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
          >
            <LogIn size={15} />
            <span>Login</span>
          </Link>
        )}
      </div>
    </header>
  );
}

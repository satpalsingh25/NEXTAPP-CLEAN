"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

export interface Branding {
  app_name:        string | null;
  browser_title:   string | null;
  logo_base64:     string | null;
  login_banner:    string | null;
  login_footer:    string | null;
  login_bg:        string | null;
  primary_color:   string | null;
  secondary_color: string | null;
  theme_mode:      "light" | "dark";
}

const DEFAULT: Branding = {
  app_name:        "Compliance & AMC",
  browser_title:   "Compliance & AMC",
  logo_base64:     null,
  login_banner:    null,
  login_footer:    null,
  login_bg:        null,
  primary_color:   "#2563eb",
  secondary_color: "#2563eb",
  theme_mode:      "light",
};

type ThemeMode = "light" | "dark";

interface Ctx {
  branding:    Branding;
  refresh:     () => Promise<void>;
  theme:       ThemeMode;
  toggleTheme: () => void;
}

const BrandingContext = createContext<Ctx>({
  branding:    DEFAULT,
  refresh:     async () => {},
  theme:       "light",
  toggleTheme: () => {},
});

const LS_KEY = "theme";

function readUserTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(LS_KEY);
  return v === "dark" || v === "light" ? v : null;
}

function normalize(data: Partial<Branding> | null | undefined): Branding {
  return {
    app_name:        (data?.app_name        as string | null | undefined) ?? DEFAULT.app_name,
    browser_title:   (data?.browser_title   as string | null | undefined) ?? DEFAULT.browser_title,
    logo_base64:     data?.logo_base64     ?? null,
    login_banner:    data?.login_banner    ?? null,
    login_footer:    data?.login_footer    ?? null,
    login_bg:        data?.login_bg        ?? null,
    primary_color:   data?.primary_color   ?? DEFAULT.primary_color,
    secondary_color: data?.secondary_color ?? DEFAULT.secondary_color,
    theme_mode:      data?.theme_mode === "dark" ? "dark" : "light",
  };
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [branding, setBranding]   = useState<Branding>(DEFAULT);
  const [theme,    setThemeState] = useState<ThemeMode>("light");
  const [userPref, setUserPref]   = useState<boolean>(false);

  /* On first mount, hydrate the user's saved theme preference. */
  useEffect(() => {
    const saved = readUserTheme();
    if (saved) {
      setThemeState(saved);
      setUserPref(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const url = "/api/branding";
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setBranding(normalize(data));
    } catch {
      /* keep existing — never crash */
    }
  }, []);

  /* Logged-in users get the authenticated branding for their company.
     Logged-out users get the public branding (used by the login page). */
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      void refresh();
    } else {
      (async () => {
        try {
          const res = await fetch("/api/branding/public");
          if (!res.ok) { setBranding(DEFAULT); return; }
          const data = await res.json();
          setBranding(normalize(data));
        } catch {
          setBranding(DEFAULT);
        }
      })();
    }
  }, [user, authLoading, refresh]);

  /* Branding theme_mode default applies only without an explicit user pref. */
  useEffect(() => {
    if (!userPref) setThemeState(branding.theme_mode);
  }, [branding.theme_mode, userPref]);

  /* Color CSS variables. */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary-color",   branding.primary_color   || DEFAULT.primary_color!);
    root.style.setProperty("--secondary-color", branding.secondary_color || DEFAULT.secondary_color!);
  }, [branding]);

  /* Dark-mode class. */
  useEffect(() => {
    if (theme === "dark") document.body.classList.add("dark");
    else                  document.body.classList.remove("dark");
  }, [theme]);

  /* Browser tab title. */
  useEffect(() => {
    document.title = branding.browser_title || branding.app_name || "App";
  }, [branding.browser_title, branding.app_name]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === "light" ? "dark" : "light";
      try { window.localStorage.setItem(LS_KEY, next); } catch { /* ignore */ }
      return next;
    });
    setUserPref(true);
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, refresh, theme, toggleTheme }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}

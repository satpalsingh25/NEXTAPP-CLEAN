"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

export interface Branding {
  logo_base64:     string | null;
  primary_color:   string | null;
  secondary_color: string | null;
  theme_mode:      "light" | "dark";
}

const DEFAULT: Branding = {
  logo_base64:     null,
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

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [branding, setBranding]   = useState<Branding>(DEFAULT);
  const [theme,    setThemeState] = useState<ThemeMode>("light");
  /* Tracks whether the user has explicitly chosen a theme (via toggle or
     a previously-saved localStorage entry). When true, branding's
     `theme_mode` no longer overrides the active theme. */
  const [userPref, setUserPref]   = useState<boolean>(false);

  /* On first mount, read any saved user preference from localStorage. */
  useEffect(() => {
    const saved = readUserTheme();
    if (saved) {
      setThemeState(saved);
      setUserPref(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/branding");
      if (!res.ok) return;
      const data = await res.json();
      setBranding({
        logo_base64:     data.logo_base64     ?? null,
        primary_color:   data.primary_color   ?? DEFAULT.primary_color,
        secondary_color: data.secondary_color ?? DEFAULT.secondary_color,
        theme_mode:      data.theme_mode === "dark" ? "dark" : "light",
      });
    } catch {
      // Network error — keep defaults; never crash the app.
    }
  }, []);

  /* Fetch branding when auth resolves with a logged-in user; reset on logout. */
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      void refresh();
    } else {
      setBranding(DEFAULT);
    }
  }, [user, authLoading, refresh]);

  /* When branding changes, only adopt its theme_mode if the user has NOT
     expressed a preference. User preference always wins. */
  useEffect(() => {
    if (!userPref) {
      setThemeState(branding.theme_mode);
    }
  }, [branding.theme_mode, userPref]);

  /* Apply CSS variables on every branding change. */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary-color",   branding.primary_color   || DEFAULT.primary_color!);
    root.style.setProperty("--secondary-color", branding.secondary_color || DEFAULT.secondary_color!);
  }, [branding]);

  /* Apply dark-mode class on every theme change. */
  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [theme]);

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

"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

export interface Branding {
  logo_url:        string | null;
  primary_color:   string | null;
  secondary_color: string | null;
  theme_mode:      "light" | "dark";
}

const DEFAULT: Branding = {
  logo_url:        null,
  primary_color:   "#2563eb",
  secondary_color: "#2563eb",
  theme_mode:      "light",
};

interface Ctx {
  branding: Branding;
  refresh:  () => Promise<void>;
}

const BrandingContext = createContext<Ctx>({ branding: DEFAULT, refresh: async () => {} });

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [branding, setBranding] = useState<Branding>(DEFAULT);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/branding");
      if (!res.ok) return;
      const data = await res.json();
      setBranding({
        logo_url:        data.logo_url        ?? null,
        primary_color:   data.primary_color   ?? DEFAULT.primary_color,
        secondary_color: data.secondary_color ?? DEFAULT.secondary_color,
        theme_mode:      data.theme_mode === "dark" ? "dark" : "light",
      });
    } catch {
      // Network error — keep defaults; never crash the app.
    }
  }, []);

  /* Fetch when auth resolves with a logged-in user; reset on logout. */
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      void refresh();
    } else {
      setBranding(DEFAULT);
    }
  }, [user, authLoading, refresh]);

  /* Apply CSS variables and dark mode class on the document. */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary-color",   branding.primary_color   || DEFAULT.primary_color!);
    root.style.setProperty("--secondary-color", branding.secondary_color || DEFAULT.secondary_color!);

    if (branding.theme_mode === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [branding]);

  return (
    <BrandingContext.Provider value={{ branding, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}

"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { Upload, Save, Image as ImageIcon } from "lucide-react";
import { useBranding } from "@/context/BrandingContext";

interface Branding {
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

const MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB raw before base64 expands ~33%

export default function BrandingSettingsPage() {
  const { refresh } = useBranding();
  const [branding, setBranding] = useState<Branding>(DEFAULT);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [toast,    setToast]    = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/branding");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setBranding({
          logo_base64:     data.logo_base64     ?? null,
          primary_color:   data.primary_color   ?? DEFAULT.primary_color,
          secondary_color: data.secondary_color ?? DEFAULT.secondary_color,
          theme_mode:      data.theme_mode === "dark" ? "dark" : "light",
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load branding");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onPickLogo = (e: ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image too large (1.5 MB max).");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      setBranding((prev) => ({ ...prev, logo_base64: result }));
    };
    reader.onerror = () => setError("Could not read file.");
    reader.readAsDataURL(file);
  };

  const removeLogo = () => setBranding((prev) => ({ ...prev, logo_base64: null }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/branding", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          logo_base64:     branding.logo_base64,
          primary_color:   branding.primary_color,
          secondary_color: branding.secondary_color,
          theme_mode:      branding.theme_mode,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `HTTP ${res.status}`);
      await refresh();
      setToast("Branding updated");
      setTimeout(() => setToast(""), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Branding Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Upload your company logo and choose the default theme. Changes apply to everyone in your company.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 space-y-6">
        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Company Logo</label>

          <div className="flex items-start gap-4">
            <div className="h-20 w-40 border border-dashed border-slate-300 dark:border-slate-600 rounded flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden">
              {branding.logo_base64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logo_base64} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <ImageIcon size={28} className="text-slate-400" />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">
                <Upload size={14} />
                <span>{branding.logo_base64 ? "Replace logo" : "Upload logo"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
              </label>
              {branding.logo_base64 && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="text-xs text-red-600 hover:underline self-start"
                >
                  Remove logo
                </button>
              )}
              <p className="text-xs text-slate-400">PNG, JPEG, or WebP — up to 1.5 MB.</p>
            </div>
          </div>
        </div>

        {/* Theme mode */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Default Theme</label>
          <select
            value={branding.theme_mode}
            onChange={(e) => setBranding((prev) => ({ ...prev, theme_mode: e.target.value === "dark" ? "dark" : "light" }))}
            className="w-48 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Each user can override this with the toggle in the header.
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-700">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--primary-color)" }}
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-sm px-4 py-2 rounded shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

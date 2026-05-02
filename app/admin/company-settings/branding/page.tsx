"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { Upload, Save, Image as ImageIcon } from "lucide-react";
import { useBranding } from "@/context/BrandingContext";

interface Branding {
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
  app_name:        "",
  browser_title:   "",
  logo_base64:     null,
  login_banner:    null,
  login_footer:    "",
  login_bg:        "",
  primary_color:   "#2563eb",
  secondary_color: "#2563eb",
  theme_mode:      "light",
};

const MAX_BYTES = 1.5 * 1024 * 1024;

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function readImageAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const r = reader.result;
      if (typeof r === "string") resolve(r);
      else reject(new Error("Could not read file"));
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function BrandingSettingsPage() {
  const { refresh } = useBranding();
  const [b,        setB]       = useState<Branding>(DEFAULT);
  const [loading,  setLoading] = useState(true);
  const [saving,   setSaving]  = useState(false);
  const [error,    setError]   = useState("");
  const [toast,    setToast]   = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/branding");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setB({
          app_name:        data.app_name        ?? "",
          browser_title:   data.browser_title   ?? "",
          logo_base64:     data.logo_base64     ?? null,
          login_banner:    data.login_banner    ?? null,
          login_footer:    data.login_footer    ?? "",
          login_bg:        data.login_bg        ?? "",
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

  const onPickImage = (field: "logo_base64" | "login_banner" | "login_bg") =>
    async (e: ChangeEvent<HTMLInputElement>) => {
      setError("");
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("Image too large (1.5 MB max).");
        return;
      }
      try {
        const dataUri = await readImageAsDataUri(file);
        setB((prev) => ({ ...prev, [field]: dataUri }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read file");
      }
    };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      /* Light client-side validation for login_bg: hex OR data URI OR empty. */
      const lbg = (b.login_bg ?? "").trim();
      if (lbg && !lbg.startsWith("#") && !lbg.startsWith("data:image/")) {
        throw new Error("Login background must be a hex color (e.g. #f1f5f9) or an uploaded image.");
      }
      if (lbg.startsWith("#") && !HEX_RE.test(lbg)) {
        throw new Error("Login background hex color is invalid.");
      }

      const res = await fetch("/api/branding", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          app_name:        b.app_name?.trim()      || null,
          browser_title:   b.browser_title?.trim() || null,
          logo_base64:     b.logo_base64,
          login_banner:    b.login_banner,
          login_footer:    b.login_footer?.trim() || null,
          login_bg:        lbg || null,
          primary_color:   b.primary_color,
          secondary_color: b.secondary_color,
          theme_mode:      b.theme_mode,
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
        <div className="h-6 w-48 rounded animate-pulse" style={{ background: "var(--card)" }} />
      </div>
    );
  }

  /* Preview helpers */
  const previewBgStyle: React.CSSProperties = (() => {
    const v = (b.login_bg ?? "").trim();
    if (!v) return { backgroundColor: "#f1f5f9" };
    if (v.startsWith("#")) return { backgroundColor: v };
    if (v.startsWith("data:image/"))
      return { backgroundImage: `url(${v})`, backgroundSize: "cover", backgroundPosition: "center" };
    return { backgroundColor: "#f1f5f9" };
  })();

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>Branding Settings</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Customize how your application looks for everyone in your company.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Form column ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* App Settings */}
          <Section title="App Settings">
            <Field label="App Name">
              <input
                type="text"
                value={b.app_name ?? ""}
                onChange={(e) => setB((p) => ({ ...p, app_name: e.target.value }))}
                placeholder="Compliance & AMC"
                className="w-full px-3 py-2 rounded text-sm border"
                style={{ background: "var(--bg)", color: "var(--text)", borderColor: "var(--border)" }}
              />
            </Field>
            <Field label="Browser Title">
              <input
                type="text"
                value={b.browser_title ?? ""}
                onChange={(e) => setB((p) => ({ ...p, browser_title: e.target.value }))}
                placeholder="Compliance & AMC Management"
                className="w-full px-3 py-2 rounded text-sm border"
                style={{ background: "var(--bg)", color: "var(--text)", borderColor: "var(--border)" }}
              />
            </Field>
            <Field label="Company Logo">
              <ImageField
                value={b.logo_base64}
                onPick={onPickImage("logo_base64")}
                onClear={() => setB((p) => ({ ...p, logo_base64: null }))}
                previewClassName="h-16 w-32"
              />
            </Field>
            <Field label="Default Theme">
              <select
                value={b.theme_mode}
                onChange={(e) => setB((p) => ({ ...p, theme_mode: e.target.value === "dark" ? "dark" : "light" }))}
                className="w-48 px-3 py-2 rounded text-sm border"
                style={{ background: "var(--bg)", color: "var(--text)", borderColor: "var(--border)" }}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                Each user can override this with the toggle in the header.
              </p>
            </Field>
          </Section>

          {/* Login Page */}
          <Section title="Login Page">
            <Field label="Banner (shown above the Sign In form)">
              <ImageField
                value={b.login_banner}
                onPick={onPickImage("login_banner")}
                onClear={() => setB((p) => ({ ...p, login_banner: null }))}
                previewClassName="h-20 w-full max-w-sm"
              />
            </Field>

            <Field label="Footer Text">
              <textarea
                value={b.login_footer ?? ""}
                onChange={(e) => setB((p) => ({ ...p, login_footer: e.target.value }))}
                rows={3}
                placeholder="Shown below the Sign In button. Supports line breaks."
                className="w-full px-3 py-2 rounded text-sm border"
                style={{ background: "var(--bg)", color: "var(--text)", borderColor: "var(--border)" }}
              />
            </Field>

            <Field label="Background">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={b.login_bg ?? ""}
                  onChange={(e) => setB((p) => ({ ...p, login_bg: e.target.value }))}
                  placeholder="#0f172a or upload an image"
                  className="flex-1 min-w-[180px] px-3 py-2 rounded text-sm border font-mono"
                  style={{ background: "var(--bg)", color: "var(--text)", borderColor: "var(--border)" }}
                />
                <label className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded cursor-pointer hover:opacity-80"
                       style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                  <Upload size={14} /> Upload image
                  <input type="file" accept="image/*" className="hidden" onChange={onPickImage("login_bg")} />
                </label>
                {b.login_bg && (
                  <button
                    type="button"
                    onClick={() => setB((p) => ({ ...p, login_bg: "" }))}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                Enter a hex color like <code>#0f172a</code> or upload an image.
              </p>
            </Field>
          </Section>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end">
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

        {/* ── Preview column ─────────────────────────────────────── */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Live Preview
          </h3>

          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="px-4 py-3 border-b text-xs font-medium" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--muted)" }}>
              Header
            </div>
            <div className="h-14 px-4 flex items-center" style={{ background: "var(--card)" }}>
              {b.logo_base64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo_base64} alt="" className="h-8 object-contain" />
              ) : (
                <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {b.app_name?.trim() || "Compliance & AMC"}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="px-4 py-3 border-b text-xs font-medium" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--muted)" }}>
              Login Page
            </div>
            <div className="p-6 min-h-[260px] flex items-center justify-center" style={previewBgStyle}>
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 w-full max-w-xs">
                {b.login_banner && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.login_banner} alt="" className="w-full max-h-16 object-contain mb-3" />
                )}
                <div className="text-center text-slate-900 font-semibold text-sm mb-3">Sign in</div>
                <div className="h-8 bg-slate-100 rounded mb-2" />
                <div className="h-8 bg-slate-100 rounded mb-3" />
                <div
                  className="h-8 rounded text-white text-xs font-medium flex items-center justify-center"
                  style={{ backgroundColor: b.primary_color || "#2563eb" }}
                >
                  Sign in
                </div>
                {b.login_footer && (
                  <div className="mt-3 text-[10px] text-slate-500 text-center whitespace-pre-line">
                    {b.login_footer}
                  </div>
                )}
              </div>
            </div>
          </div>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text)" }}>{label}</label>
      {children}
    </div>
  );
}

function ImageField({
  value, onPick, onClear, previewClassName,
}: {
  value:    string | null;
  onPick:   (e: ChangeEvent<HTMLInputElement>) => void;
  onClear:  () => void;
  previewClassName: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`${previewClassName} border border-dashed rounded flex items-center justify-center overflow-hidden`}
        style={{ borderColor: "var(--border)", background: "var(--bg)" }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <ImageIcon size={20} style={{ color: "var(--muted)" }} />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded cursor-pointer hover:opacity-80"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
        >
          <Upload size={14} />
          {value ? "Replace" : "Upload"}
          <input type="file" accept="image/*" className="hidden" onChange={onPick} />
        </label>
        {value && (
          <button type="button" onClick={onClear} className="text-xs text-red-600 hover:underline self-start">
            Remove
          </button>
        )}
        <span className="text-xs" style={{ color: "var(--muted)" }}>PNG, JPEG, or WebP — up to 1.5 MB.</span>
      </div>
    </div>
  );
}

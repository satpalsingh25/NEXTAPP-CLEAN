"use client";

import { useEffect, useState } from "react";

interface PublicBranding {
  app_name?:      string | null;
  logo_base64?:   string | null;
  login_banner?:  string | null;
  login_footer?:  string | null;
  login_bg?:      string | null;
  primary_color?: string | null;
}

/* ── Provider button descriptor ─────────────────────────────────────────────
   Future phases will populate this from /api/branding/public or a dedicated
   endpoint, driving dynamic rendering of SSO buttons.  For now only LOCAL
   is active; the others are placeholders ready to be wired up.
──────────────────────────────────────────────────────────────────────────── */
interface LoginProvider {
  id:      string;
  label:   string;
  enabled: boolean;
  onClick?: () => void;
}

/* Local-login form component — isolated so the provider layer can render
   it alongside SSO buttons without tight coupling. */
function LocalLoginForm({
  primary,
  onSuccess,
}: {
  primary: string;
  onSuccess: () => void;
}) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        credentials: "include",
        body:        JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || "Invalid email or password");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 sm:text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 sm:text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white disabled:opacity-50 transition-colors"
        style={{ backgroundColor: primary }}
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

/* ── Provider button rendered for each non-local SSO method ─────────── */
function ProviderButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
    >
      {label}
    </button>
  );
}

/* ── Main page ──────────────────────────────────────────────────────── */
export default function LoginPage() {
  const [b, setB] = useState<PublicBranding>({});

  useEffect(() => {
    fetch("/api/branding/public")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => setB(data || {}))
      .catch(() => setB({}));
  }, []);

  const bg = b.login_bg ?? "";
  const bgStyle: React.CSSProperties =
    bg.startsWith("#")
      ? { backgroundColor: bg }
      : bg.startsWith("data:image/")
        ? { backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }
        : {};

  const primary = b.primary_color || "#0f172a";
  const appName = b.app_name || "Compliance & AMC";

  /* ── Active providers list ──────────────────────────────────────────
     Phase 12+ will fetch enabled providers from the server and build
     this list dynamically.  For now only LOCAL is active.
  ─────────────────────────────────────────────────────────────────── */
  const providers: LoginProvider[] = [
    { id: "LOCAL", label: "Sign in with email", enabled: true },
    /* Future SSO entries added here by the provider-rendering phase:
       { id: "AZURE_AD",         label: "Continue with Microsoft",       enabled: false },
       { id: "GOOGLE_WORKSPACE", label: "Continue with Google",          enabled: false },
       { id: "LDAP",             label: "Continue with LDAP",            enabled: false },
       { id: "SAML",             label: "Continue with SSO",             enabled: false },
       { id: "OIDC",             label: "Continue with OIDC",            enabled: false },
    */
  ];

  const activeProviders = providers.filter((p) => p.enabled);
  const hasExternalProviders = activeProviders.some((p) => p.id !== "LOCAL");
  const hasLocalProvider     = activeProviders.some((p) => p.id === "LOCAL");

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={bgStyle}>
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-slate-200">

        {/* Branding */}
        {b.login_banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.login_banner}
            alt="Banner"
            className="w-full max-h-32 object-contain mb-4"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : b.logo_base64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.logo_base64}
            alt="Logo"
            className="h-12 mx-auto mb-4 object-contain"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : null}

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-600">Access your {appName} account</p>
        </div>

        {/* External SSO buttons rendered first when present */}
        {hasExternalProviders && (
          <div className="space-y-2 mb-4">
            {activeProviders
              .filter((p) => p.id !== "LOCAL")
              .map((p) => (
                <ProviderButton key={p.id} label={p.label} onClick={p.onClick} />
              ))}
          </div>
        )}

        {/* Divider shown only when both local and SSO are available */}
        {hasExternalProviders && hasLocalProvider && (
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs text-slate-400 bg-white px-2">
              or continue with email
            </div>
          </div>
        )}

        {/* Local login form */}
        {hasLocalProvider && (
          <LocalLoginForm
            primary={primary}
            onSuccess={() => { window.location.href = "/dashboard"; }}
          />
        )}

        {b.login_footer && (
          <p className="mt-6 text-center text-xs text-slate-500 whitespace-pre-line">
            {b.login_footer}
          </p>
        )}
      </div>
    </div>
  );
}

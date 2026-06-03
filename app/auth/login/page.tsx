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

/* ── Local login form ───────────────────────────────────────────────── */
function LocalLoginForm({
  primary,
  onSuccess,
  errorFromUrl,
}: {
  primary: string;
  onSuccess: () => void;
  errorFromUrl: string;
}) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(errorFromUrl);
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

/* ── LDAP login form ────────────────────────────────────────────────── */
function LdapLoginForm({
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
      const res = await fetch("/api/auth/ldap/login", {
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        credentials: "include",
        body:        JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || "LDAP authentication failed. Check your credentials.");
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
        <label htmlFor="ldap-email" className="block text-sm font-medium text-slate-700">
          Directory email / username
        </label>
        <input
          id="ldap-email"
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
        <label htmlFor="ldap-password" className="block text-sm font-medium text-slate-700">
          Directory password
        </label>
        <input
          id="ldap-password"
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
        {loading ? "Signing in…" : "Sign in with Directory"}
      </button>
    </form>
  );
}

/* ── Microsoft sign-in button ───────────────────────────────────────── */
function MicrosoftButton({ providerId }: { providerId: string }) {
  return (
    <a
      href={`/api/auth/azure/login?provider_id=${providerId}`}
      className="w-full flex items-center justify-center gap-3 py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
    >
      {/* Microsoft logo SVG (official brand colors) */}
      <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
        <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
        <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
        <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
      </svg>
      Sign in with Microsoft
    </a>
  );
}

/* ── Error messages for OAuth redirects ─────────────────────────────── */
const OAUTH_ERRORS: Record<string, string> = {
  azure_denied:             "Microsoft sign-in was cancelled.",
  azure_auth_failed:        "Microsoft authentication failed. Please try again.",
  state_mismatch:           "Security check failed. Please try again.",
  company_mismatch:         "Your Microsoft account is not authorised for this organisation.",
  auto_import_disabled:     "Your account does not exist here. Contact your administrator.",
  account_disabled:         "Your account has been disabled. Contact your administrator.",
  provider_not_configured:  "Microsoft login is not fully configured yet.",
  provider_unavailable:     "Microsoft login is temporarily unavailable.",
  invalid_callback:         "Invalid login response. Please try again.",
};

/* ── Divider ────────────────────────────────────────────────────────── */
function Divider({ label }: { label: string }) {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-200" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-2 text-xs text-slate-400">{label}</span>
      </div>
    </div>
  );
}

/* ── Main login page ────────────────────────────────────────────────── */
export default function LoginPage() {
  const [b,           setB]           = useState<PublicBranding>({});
  const [azureIds,    setAzureIds]    = useState<string[]>([]);
  const [showLocal,   setShowLocal]   = useState(true);
  const [showLdap,    setShowLdap]    = useState(false);
  const [urlError,    setUrlError]    = useState("");
  const [loginMode,   setLoginMode]   = useState<"local" | "ldap">("local");

  useEffect(() => {
    /* Parse error from OAuth redirect */
    const params = new URLSearchParams(window.location.search);
    const err    = params.get("error");
    if (err) setUrlError(OAUTH_ERRORS[err] ?? "Authentication failed. Please try again.");

    /* Load branding */
    fetch("/api/branding/public")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => setB(data || {}))
      .catch(() => setB({}));

    /* Load enabled providers — drives which buttons/forms appear */
    fetch("/api/auth/providers")
      .then((r) => (r.ok ? r.json() : { providers: [] }))
      .then((data: { providers: string[] }) => {
        const types = data.providers ?? [];
        setShowLocal(types.includes("LOCAL") || types.length === 0);
        setShowLdap(types.includes("LDAP"));
      })
      .catch(() => {
        setShowLocal(true);
      });

    /* Load provider IDs for Azure buttons and LDAP detection */
    fetch("/api/protected/identity-providers")
      .then((r) => (r.ok ? r.json() : []))
      .then((providers: { id: string; provider_type: string; enabled: boolean }[]) => {
        const ids = providers
          .filter((p) => p.provider_type === "AZURE_AD" && p.enabled)
          .map((p) => p.id);
        setAzureIds(ids);
      })
      .catch(() => setAzureIds([]));
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

  const hasAzure = azureIds.length > 0;
  const hasExternalProviders = hasAzure || showLdap;

  /* When only LDAP is available (no local, no Azure), default to LDAP mode */
  useEffect(() => {
    if (showLdap && !showLocal && !hasAzure) setLoginMode("ldap");
  }, [showLdap, showLocal, hasAzure]);

  const showModeSwitcher = showLocal && showLdap;

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

        {/* OAuth error message */}
        {urlError && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100">
            {urlError}
          </div>
        )}

        {/* Azure AD / Microsoft buttons */}
        {hasAzure && (
          <div className="space-y-2 mb-4">
            {azureIds.map((id) => (
              <MicrosoftButton key={id} providerId={id} />
            ))}
          </div>
        )}

        {/* Divider between SSO buttons and credential forms */}
        {hasExternalProviders && (showLocal || showLdap) && (
          <Divider label="or continue with email" />
        )}

        {/* Login mode switcher — shown when both local and LDAP are available */}
        {showModeSwitcher && (
          <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-5">
            <button
              type="button"
              onClick={() => setLoginMode("local")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                loginMode === "local"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setLoginMode("ldap")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                loginMode === "ldap"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Directory (LDAP)
            </button>
          </div>
        )}

        {/* Local login form */}
        {showLocal && (!showModeSwitcher || loginMode === "local") && (
          <LocalLoginForm
            primary={primary}
            errorFromUrl=""
            onSuccess={() => { window.location.href = "/dashboard"; }}
          />
        )}

        {/* LDAP login form */}
        {showLdap && (!showModeSwitcher || loginMode === "ldap") && (
          <LdapLoginForm
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

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

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [b,        setB]        = useState<PublicBranding>({});

  useEffect(() => {
    fetch("/api/branding/public")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => setB(data || {}))
      .catch(() => setB({}));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        setError(data.error || "Invalid email or password");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* Compute the page background style. login_bg may be a hex color or a
     data:image/* URI. */
  const bg = b.login_bg ?? "";
  const bgStyle: React.CSSProperties =
    bg.startsWith("#")
      ? { backgroundColor: bg }
      : bg.startsWith("data:image/")
        ? { backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }
        : {};

  const primary = b.primary_color || "#0f172a";
  const appName = b.app_name || "Compliance & AMC";

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={bgStyle}>
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-slate-200">
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
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {b.login_footer && (
          <p className="mt-6 text-center text-xs text-slate-500 whitespace-pre-line">
            {b.login_footer}
          </p>
        )}
      </div>
    </div>
  );
}

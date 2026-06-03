"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, RefreshCw, Save, Eye, Pencil, Ban } from "lucide-react";

interface AuthSettings {
  allow_local_login:          boolean;
  allow_azure_login:          boolean;
  allow_google_login:         boolean;
  allow_ldap_login:           boolean;
  allow_saml_login:           boolean;
  allow_oidc_login:           boolean;
  auto_import_external_users: boolean;
  auto_disable_removed_users: boolean;
}

interface IdentityProvider {
  id:            string;
  name:          string;
  provider_type: string;
  enabled:       boolean;
  created_at:    string;
}

const DEFAULT_SETTINGS: AuthSettings = {
  allow_local_login:          true,
  allow_azure_login:          false,
  allow_google_login:         false,
  allow_ldap_login:           false,
  allow_saml_login:           false,
  allow_oidc_login:           false,
  auto_import_external_users: false,
  auto_disable_removed_users: false,
};

const PROVIDER_LABEL: Record<string, string> = {
  LOCAL:            "Local",
  AZURE_AD:         "Azure AD / Entra ID",
  GOOGLE_WORKSPACE: "Google Workspace",
  LDAP:             "LDAP / Active Directory",
  SAML:             "SAML",
  OIDC:             "OIDC",
};

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-slate-100 last:border-0">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${
          checked ? "bg-blue-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer select-none" onClick={() => !disabled && onChange(!checked)}>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </label>
    </div>
  );
}

function Badge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        enabled
          ? "bg-green-100 text-green-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {enabled ? "Active" : "Disabled"}
    </span>
  );
}

export default function AuthenticationSettingsPage() {
  const [settings,   setSettings]   = useState<AuthSettings>(DEFAULT_SETTINGS);
  const [providers,  setProviders]  = useState<IdentityProvider[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sRes, pRes] = await Promise.all([
        fetch("/api/protected/auth-settings"),
        fetch("/api/protected/identity-providers"),
      ]);
      if (!sRes.ok) throw new Error("Failed to load settings.");
      if (!pRes.ok) throw new Error("Failed to load providers.");
      const [s, p] = await Promise.all([sRes.json(), pRes.json()]);
      setSettings({ ...DEFAULT_SETTINGS, ...s });
      setProviders(Array.isArray(p) ? p : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/protected/auth-settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings.");
      setSettings({ ...DEFAULT_SETTINGS, ...data });
      setSuccess("Authentication settings saved successfully.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof AuthSettings) => (val: boolean) =>
    setSettings((s) => ({ ...s, [key]: val }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Authentication Settings</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Control which login methods are available for your organisation.
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-lg">
          {success}
        </div>
      )}

      {/* ── Login Methods ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Login Methods
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            At least one method must remain enabled at all times.
          </p>
        </div>
        <div className="px-6 py-2">
          <Toggle
            id="allow_local_login"
            label="Enable Local Login"
            description="Users log in with their email and password stored in this system."
            checked={settings.allow_local_login}
            onChange={set("allow_local_login")}
          />
          <Toggle
            id="allow_azure_login"
            label="Enable Azure AD / Entra ID Login"
            description="Coming soon — Microsoft Azure Active Directory / Entra ID integration."
            checked={settings.allow_azure_login}
            onChange={set("allow_azure_login")}
          />
          <Toggle
            id="allow_google_login"
            label="Enable Google Workspace Login"
            description="Coming soon — Google Workspace OAuth 2.0 integration."
            checked={settings.allow_google_login}
            onChange={set("allow_google_login")}
          />
          <Toggle
            id="allow_ldap_login"
            label="Enable LDAP / Active Directory Login"
            description="Coming soon — LDAP / on-premise Active Directory integration."
            checked={settings.allow_ldap_login}
            onChange={set("allow_ldap_login")}
          />
          <Toggle
            id="allow_saml_login"
            label="Enable SAML Login"
            description="Coming soon — SAML 2.0 single sign-on integration."
            checked={settings.allow_saml_login}
            onChange={set("allow_saml_login")}
          />
          <Toggle
            id="allow_oidc_login"
            label="Enable OIDC Login"
            description="Coming soon — OpenID Connect integration."
            checked={settings.allow_oidc_login}
            onChange={set("allow_oidc_login")}
          />
        </div>
      </div>

      {/* ── User Sync Options ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            User Sync Options
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure automatic user provisioning and de-provisioning.
          </p>
        </div>
        <div className="px-6 py-2">
          <Toggle
            id="auto_import_external_users"
            label="Auto Import External Users"
            description="Automatically create user accounts for verified external users on first login."
            checked={settings.auto_import_external_users}
            onChange={set("auto_import_external_users")}
          />
          <Toggle
            id="auto_disable_removed_users"
            label="Auto Disable Removed Users"
            description="Automatically disable users who are removed from the external identity provider."
            checked={settings.auto_disable_removed_users}
            onChange={set("auto_disable_removed_users")}
          />
        </div>
      </div>

      {/* ── Identity Providers Table ──────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Identity Providers
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configured external authentication providers for this organisation.
            </p>
          </div>
        </div>

        {providers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No identity providers configured</p>
            <p className="text-xs text-slate-400 mt-1">
              External providers such as Azure AD, Google Workspace, or LDAP will appear here once
              configured.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {["Name", "Provider Type", "Status", "Created", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {providers.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">{p.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {PROVIDER_LABEL[p.provider_type] ?? p.provider_type}
                    </td>
                    <td className="px-6 py-4">
                      <Badge enabled={p.enabled} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          title="View"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          title="Edit"
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          title={p.enabled ? "Disable" : "Enable"}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

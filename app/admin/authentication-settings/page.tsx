"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck, RefreshCw, Save, Eye, Pencil, Ban,
  CheckCircle, XCircle, Plus, X, Loader2,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────────────── */
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
  client_id:     string | null;
  tenant_id:     string | null;
  redirect_uri:  string | null;
  scopes:        string | null;
  created_at:    string;
}

interface ProviderForm {
  name:          string;
  provider_type: string;
  client_id:     string;
  client_secret: string;
  tenant_id:     string;
  redirect_uri:  string;
  scopes:        string;
}

/* ── Constants ──────────────────────────────────────────────────────── */
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

const EMPTY_FORM: ProviderForm = {
  name:          "",
  provider_type: "AZURE_AD",
  client_id:     "",
  client_secret: "",
  tenant_id:     "",
  redirect_uri:  "",
  scopes:        "openid profile email User.Read",
};

const PROVIDER_LABEL: Record<string, string> = {
  LOCAL:            "Local",
  AZURE_AD:         "Azure AD / Entra ID",
  GOOGLE_WORKSPACE: "Google Workspace",
  LDAP:             "LDAP / Active Directory",
  SAML:             "SAML",
  OIDC:             "OIDC",
};

/* ── Sub-components ─────────────────────────────────────────────────── */
function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-slate-100 last:border-0">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          checked ? "bg-blue-600" : "bg-slate-200"
        }`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
      <div className="cursor-pointer select-none" onClick={() => onChange(!checked)}>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
    }`}>
      {enabled ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {enabled ? "Active" : "Disabled"}
    </span>
  );
}

/* ── Azure AD Provider Modal ────────────────────────────────────────── */
function AzureProviderModal({
  editProvider,
  onClose,
  onSaved,
  baseUrl,
}: {
  editProvider: IdentityProvider | null;
  onClose:  () => void;
  onSaved:  () => void;
  baseUrl:  string;
}) {
  const [form,        setForm]        = useState<ProviderForm>(() =>
    editProvider
      ? {
          name:          editProvider.name,
          provider_type: editProvider.provider_type,
          client_id:     editProvider.client_id ?? "",
          client_secret: "",                        // never pre-filled
          tenant_id:     editProvider.tenant_id ?? "",
          redirect_uri:  editProvider.redirect_uri ?? "",
          scopes:        editProvider.scopes ?? "openid profile email User.Read",
        }
      : { ...EMPTY_FORM, redirect_uri: `${baseUrl}/api/auth/azure/callback` }
  );

  const [saving,      setSaving]      = useState(false);
  const [testing,     setTesting]     = useState(false);
  const [testResult,  setTestResult]  = useState<{ success: boolean; message: string } | null>(null);
  const [error,       setError]       = useState("");

  const set = (key: keyof ProviderForm) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  const handleTest = async () => {
    if (!form.tenant_id.trim()) { setError("Enter Tenant ID first."); return; }
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const res = await fetch("/api/protected/identity-providers/test", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tenant_id: form.tenant_id.trim() }),
      });
      const data = await res.json();
      setTestResult(res.ok ? data : { success: false, message: data.error ?? "Test failed." });
    } catch {
      setTestResult({ success: false, message: "Network error during test." });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setError("");
    if (!form.name.trim())         { setError("Provider name is required."); return; }
    if (!form.tenant_id.trim())    { setError("Tenant ID is required."); return; }
    if (!form.client_id.trim())    { setError("Client ID is required."); return; }
    if (!editProvider && !form.client_secret.trim()) { setError("Client Secret is required."); return; }
    if (!form.redirect_uri.trim()) { setError("Redirect URI is required."); return; }

    setSaving(true);
    try {
      const url    = editProvider
        ? `/api/protected/identity-providers/${editProvider.id}`
        : "/api/protected/identity-providers";
      const method = editProvider ? "PUT" : "POST";

      const payload: Record<string, string> = {
        name:          form.name.trim(),
        provider_type: form.provider_type,
        client_id:     form.client_id.trim(),
        tenant_id:     form.tenant_id.trim(),
        redirect_uri:  form.redirect_uri.trim(),
        scopes:        form.scopes.trim() || "openid profile email User.Read",
      };
      if (form.client_secret.trim()) payload.client_secret = form.client_secret.trim();

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save provider.");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {editProvider ? "Edit Azure AD Provider" : "Add Azure AD Provider"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className={labelCls}>Provider Name</label>
            <input className={inputCls} placeholder="e.g. Contoso Azure AD" value={form.name} onChange={(e) => set("name")(e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Tenant ID <span className="text-slate-400 font-normal">(Directory ID)</span></label>
            <input className={inputCls} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={form.tenant_id} onChange={(e) => set("tenant_id")(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">
              Find it in Azure Portal → Azure Active Directory → Overview → Directory ID.
            </p>
          </div>

          <div>
            <label className={labelCls}>Client ID <span className="text-slate-400 font-normal">(Application ID)</span></label>
            <input className={inputCls} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={form.client_id} onChange={(e) => set("client_id")(e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>
              Client Secret
              {editProvider && <span className="ml-1 text-xs text-slate-400">(leave blank to keep existing)</span>}
            </label>
            <input
              className={inputCls}
              type="password"
              placeholder={editProvider ? "••••••••••••••••" : "Your application secret value"}
              value={form.client_secret}
              onChange={(e) => set("client_secret")(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className={labelCls}>Redirect URI</label>
            <input className={inputCls} value={form.redirect_uri} onChange={(e) => set("redirect_uri")(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">
              Add this URI to your app registration: <strong>Authentication → Redirect URIs</strong>.
            </p>
          </div>

          <div>
            <label className={labelCls}>Scopes</label>
            <input className={inputCls} value={form.scopes} onChange={(e) => set("scopes")(e.target.value)} />
          </div>

          {/* Test Connection */}
          {testResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${
              testResult.success
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {testResult.success
                ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                : <XCircle    className="h-4 w-4 mt-0.5 shrink-0" />}
              {testResult.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {testing ? "Testing…" : "Test Connection"}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save Provider"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────── */
export default function AuthenticationSettingsPage() {
  const [settings,     setSettings]     = useState<AuthSettings>(DEFAULT_SETTINGS);
  const [providers,    setProviders]    = useState<IdentityProvider[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");
  const [showModal,    setShowModal]    = useState(false);
  const [editProvider, setEditProvider] = useState<IdentityProvider | null>(null);
  const [baseUrl,      setBaseUrl]      = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const loadAll = useCallback(async () => {
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

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res  = await fetch("/api/protected/auth-settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setSettings({ ...DEFAULT_SETTINGS, ...data });
      setSuccess("Authentication settings saved.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProvider = async (provider: IdentityProvider) => {
    try {
      const res = await fetch(`/api/protected/identity-providers/${provider.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ enabled: !provider.enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle provider.");
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
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
      {/* Modal */}
      {showModal && (
        <AzureProviderModal
          editProvider={editProvider}
          baseUrl={baseUrl}
          onClose={() => { setShowModal(false); setEditProvider(null); }}
          onSaved={() => { setShowModal(false); setEditProvider(null); loadAll(); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Authentication Settings</h1>
            <p className="text-sm text-slate-500 mt-0.5">Control login methods and identity providers for your organisation.</p>
          </div>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>

      {error   && <div className="bg-red-50   border border-red-200   text-red-700   text-sm p-3 rounded-lg">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-lg">{success}</div>}

      {/* Login Methods */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Login Methods</h2>
          <p className="text-xs text-slate-500 mt-0.5">At least one method must remain enabled.</p>
        </div>
        <div className="px-6 py-2">
          <Toggle label="Enable Local Login"        description="Email + password stored in this system."                        checked={settings.allow_local_login}  onChange={set("allow_local_login")} />
          <Toggle label="Enable Azure AD / Entra ID Login" description="Microsoft Azure Active Directory via OAuth 2.0 / OIDC."  checked={settings.allow_azure_login}  onChange={set("allow_azure_login")} />
          <Toggle label="Enable Google Workspace Login" description="Coming soon — Google Workspace OAuth 2.0."                  checked={settings.allow_google_login} onChange={set("allow_google_login")} />
          <Toggle label="Enable LDAP / Active Directory Login" description="Coming soon — on-premise directory integration."     checked={settings.allow_ldap_login}   onChange={set("allow_ldap_login")} />
          <Toggle label="Enable SAML Login"         description="Coming soon — SAML 2.0 single sign-on."                        checked={settings.allow_saml_login}   onChange={set("allow_saml_login")} />
          <Toggle label="Enable OIDC Login"         description="Coming soon — OpenID Connect."                                  checked={settings.allow_oidc_login}   onChange={set("allow_oidc_login")} />
        </div>
      </div>

      {/* User Sync */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">User Sync Options</h2>
          <p className="text-xs text-slate-500 mt-0.5">Automatic provisioning and de-provisioning.</p>
        </div>
        <div className="px-6 py-2">
          <Toggle
            label="Auto Import External Users"
            description="Automatically create accounts for verified external users on first login."
            checked={settings.auto_import_external_users}
            onChange={set("auto_import_external_users")}
          />
          <Toggle
            label="Auto Disable Removed Users"
            description="Automatically disable users removed from the external identity provider."
            checked={settings.auto_disable_removed_users}
            onChange={set("auto_disable_removed_users")}
          />
        </div>
      </div>

      {/* Identity Providers Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Identity Providers</h2>
            <p className="text-xs text-slate-500 mt-0.5">Configured external authentication providers.</p>
          </div>
          <button
            onClick={() => { setEditProvider(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Azure AD
          </button>
        </div>

        {providers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No identity providers configured</p>
            <p className="text-xs text-slate-400 mt-1">Click &quot;Add Azure AD&quot; to configure your first provider.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {["Name", "Provider", "Tenant ID", "Status", "Created", "Actions"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {providers.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">{p.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{PROVIDER_LABEL[p.provider_type] ?? p.provider_type}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 font-mono">{p.tenant_id ? `${p.tenant_id.slice(0, 8)}…` : "—"}</td>
                    <td className="px-6 py-4"><StatusBadge enabled={p.enabled} /></td>
                    <td className="px-6 py-4 text-sm text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          title="View / Edit"
                          onClick={() => { setEditProvider(p); setShowModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          title={p.enabled ? "Disable provider" : "Enable provider"}
                          onClick={() => handleToggleProvider(p)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          {p.enabled ? <Ban className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

      {/* Azure Setup Guide */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-amber-800 mb-3">Azure AD App Registration Setup</h3>
        <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
          <li>Go to <strong>Azure Portal → Azure Active Directory → App registrations → New registration</strong></li>
          <li>Set a name, select supported account types (single or multi-tenant)</li>
          <li>Add a <strong>Redirect URI</strong> (Web): <code className="bg-amber-100 px-1 rounded">{baseUrl || "https://your-domain"}/api/auth/azure/callback</code></li>
          <li>After creation, copy the <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong></li>
          <li>Go to <strong>Certificates &amp; secrets → New client secret</strong>, copy the secret <em>value</em></li>
          <li>Go to <strong>API permissions → Add a permission → Microsoft Graph → Delegated</strong>: add <code className="bg-amber-100 px-1 rounded">openid</code>, <code className="bg-amber-100 px-1 rounded">profile</code>, <code className="bg-amber-100 px-1 rounded">email</code>, <code className="bg-amber-100 px-1 rounded">User.Read</code></li>
          <li>Click <strong>Grant admin consent</strong></li>
          <li>Enter all values above in the &quot;Add Azure AD&quot; form and click <strong>Test Connection</strong></li>
        </ol>
      </div>
    </div>
  );
}

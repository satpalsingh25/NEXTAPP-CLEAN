"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck, RefreshCw, Save, Eye, Pencil, Ban,
  CheckCircle, XCircle, Plus, X, Loader2, Users, GitMerge,
  HelpCircle, ChevronDown, Copy, Check, BookOpen,
  Download, RotateCcw, Server,
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
  id:                  string;
  name:                string;
  provider_type:       string;
  enabled:             boolean;
  client_id:           string | null;
  tenant_id:           string | null;
  redirect_uri:        string | null;
  scopes:              string | null;
  ldap_url:            string | null;
  ldap_bind_dn:        string | null;
  ldap_base_dn:        string | null;
  ldap_user_filter:    string | null;
  ldap_group_filter:   string | null;
  ldap_tls_enabled:    boolean | null;
  saml_entry_point:    string | null;
  saml_issuer:         string | null;
  saml_logout_url:     string | null;
  oidc_issuer_url:     string | null;
  oidc_client_id:      string | null;
  oidc_discovery_url:  string | null;
  created_at:          string;
}

interface GroupMapping {
  id:                   string;
  identity_provider_id: string;
  external_group_id:    string;
  external_group_name:  string;
  app_role:             string | null;
  auto_assign_role:     boolean;
  enabled:              boolean;
  created_at:           string;
  identity_provider:    { id: string; name: string; provider_type: string };
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

interface LdapProviderForm {
  name:              string;
  ldap_url:          string;
  ldap_bind_dn:      string;
  ldap_bind_password: string;
  ldap_base_dn:      string;
  ldap_user_filter:  string;
  ldap_group_filter: string;
  ldap_tls_enabled:  boolean;
}

interface SamlProviderForm {
  name:             string;
  saml_entry_point: string;
  saml_issuer:      string;
  saml_certificate: string;
  saml_logout_url:  string;
}

interface OidcProviderForm {
  name:               string;
  oidc_issuer_url:    string;
  oidc_discovery_url: string;
  oidc_client_id:     string;
  oidc_client_secret: string;
  scopes:             string;
}

interface MappingForm {
  identity_provider_id: string;
  external_group_id:    string;
  external_group_name:  string;
  app_role:             string;
  auto_assign_role:     boolean;
  enabled:              boolean;
}

interface SyncResult {
  imported?:    number;
  updated?:     number;
  skipped?:     number;
  synced?:      number;
  usersMapped?: number;
  errors:       string[];
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

const EMPTY_PROVIDER_FORM: ProviderForm = {
  name:          "",
  provider_type: "AZURE_AD",
  client_id:     "",
  client_secret: "",
  tenant_id:     "",
  redirect_uri:  "",
  scopes:        "openid profile email User.Read",
};

const EMPTY_LDAP_FORM: LdapProviderForm = {
  name:              "",
  ldap_url:          "ldap://",
  ldap_bind_dn:      "",
  ldap_bind_password: "",
  ldap_base_dn:      "",
  ldap_user_filter:  "(objectClass=person)",
  ldap_group_filter: "(objectClass=group)",
  ldap_tls_enabled:  false,
};

const EMPTY_SAML_FORM: SamlProviderForm = {
  name:             "",
  saml_entry_point: "",
  saml_issuer:      "",
  saml_certificate: "",
  saml_logout_url:  "",
};

const EMPTY_OIDC_FORM: OidcProviderForm = {
  name:               "",
  oidc_issuer_url:    "",
  oidc_discovery_url: "",
  oidc_client_id:     "",
  oidc_client_secret: "",
  scopes:             "openid profile email",
};

const EMPTY_MAPPING_FORM: MappingForm = {
  identity_provider_id: "",
  external_group_id:    "",
  external_group_name:  "",
  app_role:             "USER",
  auto_assign_role:     true,
  enabled:              true,
};

const PROVIDER_LABEL: Record<string, string> = {
  LOCAL:            "Local",
  AZURE_AD:         "Azure AD / Entra ID",
  GOOGLE_WORKSPACE: "Google Workspace",
  LDAP:             "LDAP / Active Directory",
  SAML:             "SAML",
  OIDC:             "OIDC",
};

const APP_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "CHECKER", "APPROVER", "CEO", "USER"];

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN:       "Admin",
  MANAGER:     "Manager",
  CHECKER:     "Checker",
  APPROVER:    "Approver",
  CEO:         "CEO",
  USER:        "User",
};

/* ── Sub-components ─────────────────────────────────────────────────── */
function Toggle({
  label, description, checked, onChange,
}: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
      <button
        type="button" role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${checked ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
      <div className="cursor-pointer select-none" onClick={() => onChange(!checked)}>
        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{description}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
      {enabled ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {enabled ? "Active" : "Disabled"}
    </span>
  );
}

/* ── Azure AD Provider Modal ────────────────────────────────────────── */
function AzureProviderModal({
  editProvider, onClose, onSaved, baseUrl,
}: {
  editProvider: IdentityProvider | null; onClose: () => void; onSaved: () => void; baseUrl: string;
}) {
  const [form,       setForm]       = useState<ProviderForm>(() =>
    editProvider
      ? { name: editProvider.name, provider_type: editProvider.provider_type,
          client_id: editProvider.client_id ?? "", client_secret: "",
          tenant_id: editProvider.tenant_id ?? "", redirect_uri: editProvider.redirect_uri ?? "",
          scopes: editProvider.scopes ?? "openid profile email User.Read" }
      : { ...EMPTY_PROVIDER_FORM, redirect_uri: `${baseUrl}/api/auth/azure/callback` }
  );
  const [saving,     setSaving]     = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error,      setError]      = useState("");

  const set = (key: keyof ProviderForm) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const handleTest = async () => {
    if (!form.tenant_id.trim()) { setError("Enter Tenant ID first."); return; }
    setTesting(true); setTestResult(null); setError("");
    try {
      const res  = await fetch("/api/protected/identity-providers/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: form.tenant_id.trim() }),
      });
      const data = await res.json();
      setTestResult(res.ok ? data : { success: false, message: data.error ?? "Test failed." });
    } catch { setTestResult({ success: false, message: "Network error during test." }); }
    finally { setTesting(false); }
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
      const url    = editProvider ? `/api/protected/identity-providers/${editProvider.id}` : "/api/protected/identity-providers";
      const method = editProvider ? "PUT" : "POST";
      const payload: Record<string, string> = {
        name: form.name.trim(), provider_type: form.provider_type,
        client_id: form.client_id.trim(), tenant_id: form.tenant_id.trim(),
        redirect_uri: form.redirect_uri.trim(), scopes: form.scopes.trim() || "openid profile email User.Read",
      };
      if (form.client_secret.trim()) payload.client_secret = form.client_secret.trim();
      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save provider.");
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const inputCls = "mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {editProvider ? "Edit Azure AD Provider" : "Add Azure AD Provider"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
          <div>
            <label className={labelCls}>Provider Name</label>
            <input className={inputCls} placeholder="e.g. Contoso Azure AD" value={form.name} onChange={(e) => set("name")(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Tenant ID <span className="text-slate-400 font-normal">(Directory ID)</span></label>
            <input className={inputCls} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={form.tenant_id} onChange={(e) => set("tenant_id")(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Azure Portal → Azure Active Directory → Overview → Directory ID.</p>
          </div>
          <div>
            <label className={labelCls}>Client ID <span className="text-slate-400 font-normal">(Application ID)</span></label>
            <input className={inputCls} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={form.client_id} onChange={(e) => set("client_id")(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>
              Client Secret {editProvider && <span className="ml-1 text-xs text-slate-400">(leave blank to keep existing)</span>}
            </label>
            <input className={inputCls} type="password" placeholder={editProvider ? "••••••••••••••••" : "Your application secret value"}
              value={form.client_secret} onChange={(e) => set("client_secret")(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className={labelCls}>Redirect URI</label>
            <input className={inputCls} value={form.redirect_uri} onChange={(e) => set("redirect_uri")(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Add this URI to your app registration: <strong>Authentication → Redirect URIs</strong>.</p>
          </div>
          <div>
            <label className={labelCls}>Scopes</label>
            <input className={inputCls} value={form.scopes} onChange={(e) => set("scopes")(e.target.value)} />
          </div>
          {testResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${testResult.success ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
              {testResult.success ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              {testResult.message}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 gap-3">
          <button type="button" onClick={handleTest} disabled={testing}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {testing ? "Testing…" : "Test Connection"}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save Provider"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── LDAP Provider Modal ────────────────────────────────────────────── */
function LdapProviderModal({
  editProvider, onClose, onSaved,
}: {
  editProvider: IdentityProvider | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<LdapProviderForm>(() =>
    editProvider
      ? {
          name:              editProvider.name,
          ldap_url:          editProvider.ldap_url          ?? "ldap://",
          ldap_bind_dn:      editProvider.ldap_bind_dn      ?? "",
          ldap_bind_password: "",
          ldap_base_dn:      editProvider.ldap_base_dn      ?? "",
          ldap_user_filter:  editProvider.ldap_user_filter  ?? "(objectClass=person)",
          ldap_group_filter: editProvider.ldap_group_filter ?? "(objectClass=group)",
          ldap_tls_enabled:  editProvider.ldap_tls_enabled  ?? false,
        }
      : { ...EMPTY_LDAP_FORM }
  );
  const [saving,      setSaving]      = useState(false);
  const [testing,     setTesting]     = useState(false);
  const [savedId,     setSavedId]     = useState<string | null>(editProvider?.id ?? null);
  const [testResult,  setTestResult]  = useState<{ success: boolean; message: string } | null>(null);
  const [error,       setError]       = useState("");

  const set = <K extends keyof LdapProviderForm>(key: K, val: LdapProviderForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setError("");
    if (!form.name.trim())           { setError("Provider name is required."); return; }
    if (!form.ldap_url.trim())       { setError("LDAP URL is required."); return; }
    if (!form.ldap_bind_dn.trim())   { setError("Bind DN is required."); return; }
    if (!editProvider && !form.ldap_bind_password.trim()) { setError("Bind password is required."); return; }
    if (!form.ldap_base_dn.trim())   { setError("Base DN is required."); return; }

    setSaving(true);
    try {
      const url    = editProvider ? `/api/protected/identity-providers/${editProvider.id}` : "/api/protected/identity-providers";
      const method = editProvider ? "PUT" : "POST";
      const payload: Record<string, unknown> = {
        name:              form.name.trim(),
        provider_type:     "LDAP",
        ldap_url:          form.ldap_url.trim(),
        ldap_bind_dn:      form.ldap_bind_dn.trim(),
        ldap_base_dn:      form.ldap_base_dn.trim(),
        ldap_user_filter:  form.ldap_user_filter.trim()  || "(objectClass=person)",
        ldap_group_filter: form.ldap_group_filter.trim() || "(objectClass=group)",
        ldap_tls_enabled:  form.ldap_tls_enabled,
      };
      if (form.ldap_bind_password.trim()) payload.ldap_bind_password = form.ldap_bind_password.trim();
      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save provider.");
      setSavedId(data.id ?? editProvider?.id ?? null);
      setTestResult(null);
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!savedId) { setError("Save the provider first, then test the connection."); return; }
    setTesting(true); setTestResult(null); setError("");
    try {
      const res  = await fetch("/api/protected/auth/ldap/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: savedId }),
      });
      const data = await res.json();
      setTestResult(res.ok ? (data.data ?? data) : { success: false, message: data.error ?? "Test failed." });
    } catch { setTestResult({ success: false, message: "Network error during test." }); }
    finally { setTesting(false); }
  };

  const inputCls = "mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {editProvider ? "Edit LDAP / AD Provider" : "Add LDAP / Active Directory Provider"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

          <div>
            <label className={labelCls}>Provider Name</label>
            <input className={inputCls} placeholder="e.g. Contoso Active Directory" value={form.name}
              onChange={(e) => set("name", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>LDAP Server URL</label>
            <input className={inputCls} placeholder="ldap://dc.example.com:389  or  ldaps://dc.example.com:636"
              value={form.ldap_url} onChange={(e) => set("ldap_url", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Use <code>ldaps://</code> for TLS on port 636, or <code>ldap://</code> for standard port 389.</p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <input type="checkbox" id="tls" checked={form.ldap_tls_enabled}
              onChange={(e) => set("ldap_tls_enabled", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <label htmlFor="tls" className="text-sm text-slate-700 cursor-pointer">Enable TLS / LDAPS (skip certificate verification)</label>
          </div>

          <div>
            <label className={labelCls}>Bind DN <span className="text-slate-400 font-normal">(service account)</span></label>
            <input className={inputCls} placeholder="CN=svc-ldap,OU=ServiceAccounts,DC=example,DC=com"
              value={form.ldap_bind_dn} onChange={(e) => set("ldap_bind_dn", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Distinguished name of the service account used to search the directory.</p>
          </div>

          <div>
            <label className={labelCls}>
              Bind Password {editProvider && <span className="ml-1 text-xs text-slate-400">(leave blank to keep existing)</span>}
            </label>
            <input className={inputCls} type="password" autoComplete="new-password"
              placeholder={editProvider ? "••••••••••••••••" : "Service account password"}
              value={form.ldap_bind_password} onChange={(e) => set("ldap_bind_password", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Base DN <span className="text-slate-400 font-normal">(search root)</span></label>
            <input className={inputCls} placeholder="DC=example,DC=com"
              value={form.ldap_base_dn} onChange={(e) => set("ldap_base_dn", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">All user and group searches start from this DN.</p>
          </div>

          <div>
            <label className={labelCls}>User Filter <span className="text-slate-400 font-normal">(optional)</span></label>
            <input className={inputCls} placeholder="(objectClass=person)" value={form.ldap_user_filter}
              onChange={(e) => set("ldap_user_filter", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">LDAP filter for users. Default: <code>(objectClass=person)</code>. For AD: <code>(&amp;(objectClass=user)(!(objectClass=computer)))</code></p>
          </div>

          <div>
            <label className={labelCls}>Group Filter <span className="text-slate-400 font-normal">(optional)</span></label>
            <input className={inputCls} placeholder="(objectClass=group)" value={form.ldap_group_filter}
              onChange={(e) => set("ldap_group_filter", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">LDAP filter for groups. Default: <code>(objectClass=group)</code>. For OpenLDAP: <code>(objectClass=groupOfNames)</code></p>
          </div>

          {testResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${testResult.success ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
              {testResult.success ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              {testResult.message}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 gap-3">
          <button type="button" onClick={handleTest} disabled={testing || !savedId}
            title={!savedId ? "Save the provider first to enable connection testing." : undefined}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
            {testing ? "Testing…" : "Test Connection"}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save Provider"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── SAML Provider Modal ────────────────────────────────────────────── */
function SamlProviderModal({
  editProvider, onClose, onSaved,
}: {
  editProvider: IdentityProvider | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<SamlProviderForm>(() =>
    editProvider
      ? {
          name:             editProvider.name,
          saml_entry_point: editProvider.saml_entry_point ?? "",
          saml_issuer:      editProvider.saml_issuer      ?? "",
          saml_certificate: "",   // never pre-filled — write-only
          saml_logout_url:  editProvider.saml_logout_url  ?? "",
        }
      : { ...EMPTY_SAML_FORM }
  );
  const [saving,     setSaving]     = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [savedId,    setSavedId]    = useState<string | null>(editProvider?.id ?? null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [error,      setError]      = useState("");

  const set = <K extends keyof SamlProviderForm>(key: K, val: SamlProviderForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setError("");
    if (!form.name.trim())             { setError("Provider name is required."); return; }
    if (!form.saml_entry_point.trim()) { setError("IdP Entry Point URL is required."); return; }
    if (!form.saml_issuer.trim())      { setError("IdP Issuer (Entity ID) is required."); return; }
    if (!editProvider && !form.saml_certificate.trim()) { setError("X.509 Certificate is required for new providers."); return; }

    setSaving(true);
    try {
      const url    = editProvider ? `/api/protected/identity-providers/${editProvider.id}` : "/api/protected/identity-providers";
      const method = editProvider ? "PUT" : "POST";
      const payload: Record<string, unknown> = {
        name:             form.name.trim(),
        provider_type:    "SAML",
        saml_entry_point: form.saml_entry_point.trim(),
        saml_issuer:      form.saml_issuer.trim(),
        saml_logout_url:  form.saml_logout_url.trim() || null,
      };
      if (form.saml_certificate.trim()) payload.saml_certificate = form.saml_certificate.trim();
      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save provider.");
      setSavedId(data.id ?? editProvider?.id ?? null);
      setTestResult(null);
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!savedId) { setError("Save the provider first, then test the connection."); return; }
    setTesting(true); setTestResult(null); setError("");
    try {
      const res  = await fetch("/api/protected/auth/saml/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: savedId }),
      });
      const data = await res.json();
      setTestResult(res.ok ? (data.data ?? data) : { success: false, message: data.error ?? "Test failed." });
    } catch { setTestResult({ success: false, message: "Network error during test." }); }
    finally { setTesting(false); }
  };

  const inputCls    = "mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";
  const textareaCls = "mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs";
  const labelCls    = "block text-sm font-medium text-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {editProvider ? "Edit SAML 2.0 Provider" : "Add SAML 2.0 Provider"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

          <div>
            <label className={labelCls}>Provider Name</label>
            <input className={inputCls} placeholder="e.g. Okta SSO" value={form.name}
              onChange={(e) => set("name", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>IdP Entry Point URL <span className="text-red-500">*</span></label>
            <input className={inputCls} placeholder="https://your-idp.example.com/sso/saml"
              value={form.saml_entry_point} onChange={(e) => set("saml_entry_point", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">
              The SSO URL from your IdP (e.g. Okta: <em>Sign On → Identity Provider Single Sign-On URL</em>).
            </p>
          </div>

          <div>
            <label className={labelCls}>Issuer / Entity ID <span className="text-red-500">*</span></label>
            <input className={inputCls} placeholder="https://your-idp.example.com"
              value={form.saml_issuer} onChange={(e) => set("saml_issuer", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">
              The IdP&apos;s entity ID (e.g. Okta: <em>Identity Provider Issuer</em>). Can be a URL or a URN.
            </p>
          </div>

          <div>
            <label className={labelCls}>
              X.509 Certificate <span className="text-red-500">*</span>
              {editProvider && <span className="ml-1 text-xs text-slate-400">(leave blank to keep existing)</span>}
            </label>
            <textarea rows={6} className={textareaCls}
              placeholder={"-----BEGIN CERTIFICATE-----\nMIIC...your IdP certificate here...\n-----END CERTIFICATE-----"}
              value={form.saml_certificate} onChange={(e) => set("saml_certificate", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">
              Paste the full PEM certificate from your IdP. In Okta: <em>Sign On → SAML Signing Certificates</em>.
            </p>
          </div>

          <div>
            <label className={labelCls}>Logout URL <span className="text-slate-400 font-normal">(optional)</span></label>
            <input className={inputCls} placeholder="https://your-idp.example.com/slo/saml"
              value={form.saml_logout_url} onChange={(e) => set("saml_logout_url", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Single Logout URL for SP-initiated logout (optional).</p>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-xs text-indigo-800 space-y-1.5">
            <p className="font-semibold text-indigo-900">SP Configuration (provide to your IdP)</p>
            <p>• <strong>ACS URL</strong> (Assertion Consumer Service): <code className="bg-indigo-100 px-1 rounded">/api/auth/saml/callback</code></p>
            <p>• <strong>SP Entity ID / Audience</strong>: use the same value as your Issuer field above</p>
            <p>• <strong>Name ID format</strong>: Email Address</p>
            <p>• <strong>Attribute</strong>: map <code className="bg-indigo-100 px-1 rounded">email</code> claim</p>
          </div>

          {testResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${testResult.success ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
              {testResult.success ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <div>
                {testResult.message}
                {testResult.details && <pre className="mt-1 text-xs opacity-70 whitespace-pre-wrap">{testResult.details}</pre>}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 gap-3">
          <button type="button" onClick={handleTest} disabled={testing || !savedId}
            title={!savedId ? "Save the provider first to enable connection testing." : undefined}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
            {testing ? "Testing…" : "Test Connection"}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save Provider"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── OIDC Provider Modal ─────────────────────────────────────────────── */
function OidcProviderModal({
  editProvider, onClose, onSaved,
}: {
  editProvider: IdentityProvider | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<OidcProviderForm>(() =>
    editProvider
      ? {
          name:               editProvider.name,
          oidc_issuer_url:    editProvider.oidc_issuer_url    ?? "",
          oidc_discovery_url: editProvider.oidc_discovery_url ?? "",
          oidc_client_id:     editProvider.oidc_client_id     ?? "",
          oidc_client_secret: "",   // never pre-filled
          scopes:             editProvider.scopes ?? "openid profile email",
        }
      : { ...EMPTY_OIDC_FORM }
  );
  const [saving,     setSaving]     = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [savedId,    setSavedId]    = useState<string | null>(editProvider?.id ?? null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [error,      setError]      = useState("");

  const set = <K extends keyof OidcProviderForm>(key: K, val: OidcProviderForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setError("");
    if (!form.name.trim())           { setError("Provider name is required."); return; }
    if (!form.oidc_issuer_url.trim() && !form.oidc_discovery_url.trim()) { setError("Issuer URL or Discovery URL is required."); return; }
    if (!form.oidc_client_id.trim()) { setError("Client ID is required."); return; }
    if (!editProvider && !form.oidc_client_secret.trim()) { setError("Client Secret is required for new providers."); return; }

    setSaving(true);
    try {
      const url    = editProvider ? `/api/protected/identity-providers/${editProvider.id}` : "/api/protected/identity-providers";
      const method = editProvider ? "PUT" : "POST";
      const payload: Record<string, unknown> = {
        name:               form.name.trim(),
        provider_type:      "OIDC",
        oidc_issuer_url:    form.oidc_issuer_url.trim()    || null,
        oidc_discovery_url: form.oidc_discovery_url.trim() || null,
        oidc_client_id:     form.oidc_client_id.trim(),
        scopes:             form.scopes.trim() || "openid profile email",
      };
      if (form.oidc_client_secret.trim()) payload.oidc_client_secret = form.oidc_client_secret.trim();
      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save provider.");
      setSavedId(data.id ?? editProvider?.id ?? null);
      setTestResult(null);
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!savedId) { setError("Save the provider first, then test the connection."); return; }
    setTesting(true); setTestResult(null); setError("");
    try {
      const res  = await fetch("/api/protected/auth/oidc/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: savedId }),
      });
      const data = await res.json();
      setTestResult(res.ok ? (data.data ?? data) : { success: false, message: data.error ?? "Test failed." });
    } catch { setTestResult({ success: false, message: "Network error during test." }); }
    finally { setTesting(false); }
  };

  const inputCls  = "mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelCls  = "block text-sm font-medium text-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {editProvider ? "Edit OIDC Provider" : "Add OpenID Connect Provider"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

          <div>
            <label className={labelCls}>Provider Name</label>
            <input className={inputCls} placeholder="e.g. Okta OIDC" value={form.name}
              onChange={(e) => set("name", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Issuer URL</label>
            <input className={inputCls} placeholder="https://your-domain.okta.com"
              value={form.oidc_issuer_url} onChange={(e) => set("oidc_issuer_url", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">
              The base URL of your IdP. Used to auto-discover{" "}
              <code className="bg-slate-100 px-1 rounded">/.well-known/openid-configuration</code>.
            </p>
          </div>

          <div>
            <label className={labelCls}>Discovery URL <span className="text-slate-400 font-normal">(optional override)</span></label>
            <input className={inputCls} placeholder="https://your-domain.okta.com/.well-known/openid-configuration"
              value={form.oidc_discovery_url} onChange={(e) => set("oidc_discovery_url", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">
              Override the discovery URL if your IdP uses a non-standard path.
            </p>
          </div>

          <div>
            <label className={labelCls}>Client ID <span className="text-red-500">*</span></label>
            <input className={inputCls} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={form.oidc_client_id} onChange={(e) => set("oidc_client_id", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>
              Client Secret <span className="text-red-500">*</span>
              {editProvider && <span className="ml-1 text-xs text-slate-400">(leave blank to keep existing)</span>}
            </label>
            <input className={inputCls} type="password" autoComplete="new-password"
              placeholder={editProvider ? "••••••••••••••••" : "Client secret from your IdP"}
              value={form.oidc_client_secret} onChange={(e) => set("oidc_client_secret", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Scopes <span className="text-slate-400 font-normal">(space-separated)</span></label>
            <input className={inputCls} placeholder="openid profile email"
              value={form.scopes} onChange={(e) => set("scopes", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">
              Standard: <code className="bg-slate-100 px-1 rounded">openid profile email</code>.
              Some providers require additional scopes (e.g. <code className="bg-slate-100 px-1 rounded">offline_access</code>).
            </p>
          </div>

          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 text-xs text-sky-800 space-y-1.5">
            <p className="font-semibold text-sky-900">IdP Configuration</p>
            <p>• <strong>Grant type</strong>: Authorization Code</p>
            <p>• <strong>Redirect / Callback URI</strong>: <code className="bg-sky-100 px-1 rounded">/api/auth/oidc/callback</code></p>
            <p>• Required claims: <code className="bg-sky-100 px-1 rounded">sub</code>, <code className="bg-sky-100 px-1 rounded">email</code></p>
          </div>

          {testResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${testResult.success ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
              {testResult.success ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <div>
                {testResult.message}
                {testResult.details && <pre className="mt-1 text-xs opacity-70 whitespace-pre-wrap">{testResult.details}</pre>}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 gap-3">
          <button type="button" onClick={handleTest} disabled={testing || !savedId}
            title={!savedId ? "Save the provider first to enable connection testing." : undefined}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
            {testing ? "Testing…" : "Fetch Discovery"}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save Provider"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Group Mapping Modal ────────────────────────────────────────────── */
function GroupMappingModal({
  editMapping, providers, onClose, onSaved,
}: {
  editMapping: GroupMapping | null; providers: IdentityProvider[]; onClose: () => void; onSaved: () => void;
}) {
  const externalProviders = providers.filter((p) => (p.provider_type === "AZURE_AD" || p.provider_type === "LDAP") && p.enabled);

  const [form,  setForm]  = useState<MappingForm>(() =>
    editMapping
      ? {
          identity_provider_id: editMapping.identity_provider_id,
          external_group_id:    editMapping.external_group_id,
          external_group_name:  editMapping.external_group_name,
          app_role:             editMapping.app_role ?? "USER",
          auto_assign_role:     editMapping.auto_assign_role,
          enabled:              editMapping.enabled,
        }
      : { ...EMPTY_MAPPING_FORM, identity_provider_id: externalProviders[0]?.id ?? "" }
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = <K extends keyof MappingForm>(key: K, val: MappingForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const selectedProvider = providers.find((p) => p.id === form.identity_provider_id);
  const isLdap = selectedProvider?.provider_type === "LDAP";

  const handleSave = async () => {
    setError("");
    if (!form.identity_provider_id) { setError("Select an identity provider."); return; }
    if (!form.external_group_id.trim())   { setError(`${isLdap ? "Group DN" : "Group ID"} is required.`); return; }
    if (!form.external_group_name.trim()) { setError("Group Name is required."); return; }

    setSaving(true);
    try {
      const url    = editMapping ? `/api/protected/auth/group-mappings/${editMapping.id}` : "/api/protected/auth/group-mappings";
      const method = editMapping ? "PUT" : "POST";
      const res    = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity_provider_id: form.identity_provider_id,
          external_group_id:    form.external_group_id.trim(),
          external_group_name:  form.external_group_name.trim(),
          app_role:             form.app_role || null,
          auto_assign_role:     form.auto_assign_role,
          enabled:              form.enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save mapping.");
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const inputCls  = "mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelCls  = "block text-sm font-medium text-slate-700";
  const selectCls = "mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {editMapping ? "Edit Group Mapping" : "Add Group Mapping"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

          {!editMapping && (
            <div>
              <label className={labelCls}>Identity Provider</label>
              <select className={selectCls} value={form.identity_provider_id}
                onChange={(e) => set("identity_provider_id", e.target.value)}>
                <option value="">Select provider…</option>
                {externalProviders.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({PROVIDER_LABEL[p.provider_type] ?? p.provider_type})</option>
                ))}
              </select>
              {externalProviders.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">No active Azure AD or LDAP providers found. Add one first.</p>
              )}
            </div>
          )}

          <div>
            <label className={labelCls}>Group Name</label>
            <input className={inputCls} placeholder={isLdap ? "e.g. IT Admins" : "e.g. IT-Admins"} value={form.external_group_name}
              onChange={(e) => set("external_group_name", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>
              {isLdap ? "Group DN" : "Group ID"}{" "}
              <span className="text-slate-400 font-normal">
                {isLdap ? "(Distinguished Name)" : "(Object ID)"}
              </span>
            </label>
            <input className={inputCls}
              placeholder={isLdap ? "CN=IT-Admins,OU=Groups,DC=example,DC=com" : "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
              value={form.external_group_id} onChange={(e) => set("external_group_id", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">
              {isLdap
                ? "Full DN of the LDAP group. Must match the group DN returned by your directory."
                : "Azure Portal → Groups → select group → Object ID."}
            </p>
          </div>

          <div>
            <label className={labelCls}>App Role</label>
            <select className={selectCls} value={form.app_role} onChange={(e) => set("app_role", e.target.value)}>
              <option value="">No role assignment</option>
              {APP_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Role assigned to users in this group.</p>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.auto_assign_role}
                onChange={(e) => set("auto_assign_role", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-slate-700">Auto-assign role on login</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.enabled}
                onChange={(e) => set("enabled", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-slate-700">Enabled</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save Mapping"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Help Tab ───────────────────────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <button onClick={handleCopy} title="Copy to clipboard"
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition-colors shrink-0">
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2 mt-1 bg-slate-100 rounded-md px-3 py-1.5 text-xs font-mono text-slate-700 break-all">
      <span className="flex-1">{value}</span>
      <CopyButton text={value} />
    </div>
  );
}

function AccordionItem({
  title, icon, children, defaultOpen = false,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5"
        style={{ background: "var(--card)" }}>
        <div className="flex items-center gap-3">
          <span className="text-blue-500">{icon}</span>
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</span>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--muted)" }} />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t text-sm space-y-3" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--muted)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  );
}

function HelpTab({ baseUrl }: { baseUrl: string }) {
  const domain = baseUrl || "https://your-domain.com";

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-xl shadow-sm border px-6 py-4 flex items-center gap-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="p-2 bg-blue-600/10 rounded-lg border border-blue-600/20">
          <BookOpen className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Integration Guides</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Step-by-step setup instructions for each identity provider type.</p>
        </div>
      </div>

      {/* Azure AD */}
      <AccordionItem defaultOpen title="Azure AD / Entra ID" icon={
        <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
          <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
          <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
          <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
      }>
        <p className="font-medium text-slate-700">Azure AD App Registration Setup</p>
        <div className="space-y-3 mt-2">
          <Step n={1}><span>Go to <strong>Azure Portal → Azure Active Directory → App registrations → New registration</strong></span></Step>
          <Step n={2}><span>Set a name, select supported account types (single-tenant or multi-tenant)</span></Step>
          <Step n={3}>
            <div>
              <span>Add a <strong>Redirect URI</strong> (Web):</span>
              <CodeBlock value={`${domain}/api/auth/azure/callback`} />
            </div>
          </Step>
          <Step n={4}><span>Copy the <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong></span></Step>
          <Step n={5}><span>Go to <strong>Certificates &amp; secrets → New client secret</strong> — copy the <em>value</em> (not the ID)</span></Step>
          <Step n={6}><span>Go to <strong>API permissions → Microsoft Graph → Delegated</strong> and add: <code className="bg-slate-100 px-1 rounded">openid</code>, <code className="bg-slate-100 px-1 rounded">profile</code>, <code className="bg-slate-100 px-1 rounded">email</code>, <code className="bg-slate-100 px-1 rounded">User.Read</code></span></Step>
          <Step n={7}><span>For user/group sync also add <strong>Application permissions</strong>: <code className="bg-slate-100 px-1 rounded">User.Read.All</code>, <code className="bg-slate-100 px-1 rounded">Group.Read.All</code></span></Step>
          <Step n={8}><span>Click <strong>Grant admin consent</strong></span></Step>
          <Step n={9}><span>In the <strong>Identity Providers</strong> tab, click <strong>Add Azure AD</strong> and enter the Client ID, Tenant ID, and Client Secret</span></Step>
        </div>
      </AccordionItem>

      {/* Google Workspace */}
      <AccordionItem title="Google Workspace / Google Login" icon={
        <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      }>
        <p className="font-medium text-slate-700">Google Workspace / Google Login Setup</p>
        <div className="bg-sky-50 border border-sky-200 rounded-lg px-4 py-2 text-xs text-sky-700 mt-1">
          Google authentication is configured through an <strong>OIDC Provider</strong>. Follow the OIDC steps below using Google&apos;s values.
        </div>
        <div className="space-y-3 mt-2">
          <Step n={1}><span>Open <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Cloud Console</a> and create a new project</span></Step>
          <Step n={2}><span>Navigate to <strong>APIs &amp; Services → OAuth consent screen</strong> and configure it (User Type: External or Internal)</span></Step>
          <Step n={3}><span>Go to <strong>APIs &amp; Services → Credentials → Create Credentials → OAuth 2.0 Client ID</strong></span></Step>
          <Step n={4}><span>Set Application Type to <strong>Web Application</strong> and add the Redirect URI:</span>
            <CodeBlock value={`${domain}/api/auth/oidc/callback`} />
          </Step>
          <Step n={5}><span>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong></span></Step>
          <Step n={6}>
            <div>
              <span>In the <strong>Identity Providers</strong> tab, click <strong>Add OIDC</strong> and enter:</span>
              <div className="mt-2 space-y-1">
                <div className="text-xs text-slate-500">Issuer URL:</div>
                <CodeBlock value="https://accounts.google.com" />
                <div className="text-xs text-slate-500 mt-1">Discovery URL:</div>
                <CodeBlock value="https://accounts.google.com/.well-known/openid-configuration" />
                <div className="text-xs text-slate-500 mt-1">Scopes:</div>
                <CodeBlock value="openid profile email" />
              </div>
            </div>
          </Step>
          <Step n={7}><span>Enable <strong>OIDC Login</strong> in the Login Methods tab and save</span></Step>
        </div>
      </AccordionItem>

      {/* LDAP */}
      <AccordionItem title="LDAP / Active Directory" icon={<Server className="h-4.5 w-4.5" />}>
        <p className="font-medium text-slate-700">LDAP / Active Directory Setup</p>
        <div className="space-y-3 mt-2">
          <Step n={1}><span>Create a <strong>read-only service account</strong> in your directory with permission to search users and groups</span></Step>
          <Step n={2}>
            <div>
              <span>Collect the service account&apos;s <strong>Bind DN</strong> and <strong>password</strong>, plus your directory&apos;s <strong>Base DN</strong>. Example:</span>
              <CodeBlock value="DC=example,DC=com" />
            </div>
          </Step>
          <Step n={3}><span>In the <strong>Identity Providers</strong> tab, click <strong>Add LDAP</strong></span></Step>
          <Step n={4}><span>Fill in the form:<br /><strong>LDAP URL</strong> — e.g. <code className="bg-slate-100 px-1 rounded">ldap://dc.example.com:389</code> or <code className="bg-slate-100 px-1 rounded">ldaps://dc.example.com:636</code><br /><strong>Bind DN</strong>, <strong>Password</strong>, <strong>Base DN</strong><br /><strong>User Filter</strong> (default: <code className="bg-slate-100 px-1 rounded">(objectClass=person)</code>)<br /><strong>Group Filter</strong> (default: <code className="bg-slate-100 px-1 rounded">(objectClass=group)</code>)</span></Step>
          <Step n={5}><span>Enable <strong>LDAP / AD Login</strong> in the Login Methods tab and save</span></Step>
          <Step n={6}><span>Use <strong>Import Users</strong> in the Group Mapping tab to pull directory users into the app</span></Step>
        </div>
      </AccordionItem>

      {/* SAML */}
      <AccordionItem title="SAML 2.0" icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round"/>
          <circle cx="12" cy="12" r="3" fill="#6366f1"/>
        </svg>
      }>
        <p className="font-medium text-slate-700">SAML 2.0 Setup</p>
        <div className="flex flex-wrap gap-1.5 mt-1 mb-3">
          {["Okta", "Keycloak", "OneLogin", "Ping Identity", "Google Workspace"].map((idp) => (
            <span key={idp} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100">{idp}</span>
          ))}
        </div>
        <div className="space-y-3">
          <Step n={1}><span>In your IdP, create a new <strong>SAML 2.0 Application</strong></span></Step>
          <Step n={2}>
            <div>
              <span>Configure the SP settings in your IdP:</span>
              <div className="mt-2 space-y-1">
                <div className="text-xs text-slate-500">ACS URL (Assertion Consumer Service):</div>
                <CodeBlock value={`${domain}/api/auth/saml/callback`} />
                <div className="text-xs text-slate-500 mt-1">SP Entity ID / Audience — use the same value as your Issuer field in the SAML provider form (e.g. your app URL):</div>
                <CodeBlock value={domain} />
                <div className="text-xs text-slate-500 mt-1">Name ID format:</div>
                <CodeBlock value="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" />
              </div>
            </div>
          </Step>
          <Step n={3}><span>Map the <strong>email</strong> attribute in your IdP SAML app (most IdPs do this by default)</span></Step>
          <Step n={4}><span>Copy from your IdP: <strong>Entry Point URL</strong>, <strong>Issuer / Entity ID</strong>, and the <strong>X.509 Certificate</strong></span></Step>
          <Step n={5}><span>In the <strong>Identity Providers</strong> tab, click <strong>Add SAML</strong> and enter the values</span></Step>
          <Step n={6}><span>Enable <strong>SAML Login</strong> in the Login Methods tab and save</span></Step>
          <Step n={7}><span>Click <strong>Test Connection</strong> to verify the entry point is reachable before going live</span></Step>
        </div>
      </AccordionItem>

      {/* OIDC */}
      <AccordionItem title="OIDC / OpenID Connect" icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="#0ea5e9" strokeWidth="2"/>
          <path d="M12 8v4l3 3" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      }>
        <p className="font-medium text-slate-700">OIDC / OpenID Connect Setup</p>
        <div className="flex flex-wrap gap-1.5 mt-1 mb-3">
          {["Auth0", "Okta", "Keycloak", "Google", "OneLogin", "Azure AD B2C"].map((idp) => (
            <span key={idp} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-sky-50 text-sky-700 border border-sky-100">{idp}</span>
          ))}
        </div>
        <div className="space-y-3">
          <Step n={1}><span>In your IdP, create a new <strong>OIDC Application</strong> (Application Type: Web / Regular Web App)</span></Step>
          <Step n={2}>
            <div>
              <span>Add the callback URL (Allowed Redirect URI / Login URL):</span>
              <CodeBlock value={`${domain}/api/auth/oidc/callback`} />
            </div>
          </Step>
          <Step n={3}><span>Set the Grant Type to <strong>Authorization Code</strong></span></Step>
          <Step n={4}><span>Copy from your IdP: <strong>Issuer URL</strong> (or Discovery URL), <strong>Client ID</strong>, <strong>Client Secret</strong></span></Step>
          <Step n={5}><span>In the <strong>Identity Providers</strong> tab, click <strong>Add OIDC</strong> and fill in the form. The Issuer URL is used to auto-discover <code className="bg-slate-100 px-1 rounded">/.well-known/openid-configuration</code></span></Step>
          <Step n={6}><span>Click <strong>Fetch Discovery</strong> to verify the IdP is reachable and the config is correct</span></Step>
          <Step n={7}><span>Enable <strong>OIDC Login</strong> in the Login Methods tab and save</span></Step>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3 text-xs text-amber-700 space-y-1">
          <p className="font-semibold text-amber-800">Common IdP discovery URLs</p>
          <div className="space-y-1.5 mt-1">
            {[
              ["Auth0",     "https://YOUR-DOMAIN.auth0.com"],
              ["Okta",      "https://YOUR-DOMAIN.okta.com"],
              ["Google",    "https://accounts.google.com"],
              ["Keycloak",  "https://YOUR-HOST/realms/YOUR-REALM"],
              ["Azure B2C", "https://YOUR-TENANT.b2clogin.com/YOUR-TENANT.onmicrosoft.com/v2.0"],
            ].map(([name, url]) => (
              <div key={name} className="flex items-center gap-2">
                <span className="w-16 shrink-0 font-medium">{name}:</span>
                <div className="flex items-center gap-1.5 bg-amber-100 rounded px-2 py-0.5 flex-1 min-w-0">
                  <code className="text-amber-800 text-xs truncate flex-1">{url}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AccordionItem>

      {/* Footer note */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 flex items-start gap-2">
        <HelpCircle className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
        <p>
          Your app URL detected as: <strong className="text-slate-700">{domain}</strong>.
          All callback and redirect URIs above use this base URL automatically.
          If your production domain differs, update the URIs in your IdP accordingly.
        </p>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────── */
type ActiveTab = "methods" | "providers" | "groups" | "help";

export default function AuthenticationSettingsPage() {
  const [activeTab,    setActiveTab]    = useState<ActiveTab>("methods");
  const [settings,     setSettings]     = useState<AuthSettings>(DEFAULT_SETTINGS);
  const [providers,    setProviders]    = useState<IdentityProvider[]>([]);
  const [mappings,     setMappings]     = useState<GroupMapping[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");

  /* Azure provider modal */
  const [showAzureModal,  setShowAzureModal]  = useState(false);
  const [editAzureProvider, setEditAzureProvider] = useState<IdentityProvider | null>(null);

  /* LDAP provider modal */
  const [showLdapModal,   setShowLdapModal]   = useState(false);
  const [editLdapProvider, setEditLdapProvider] = useState<IdentityProvider | null>(null);

  /* SAML provider modal */
  const [showSamlModal,  setShowSamlModal]  = useState(false);
  const [editSamlProvider, setEditSamlProvider] = useState<IdentityProvider | null>(null);

  /* OIDC provider modal */
  const [showOidcModal,  setShowOidcModal]  = useState(false);
  const [editOidcProvider, setEditOidcProvider] = useState<IdentityProvider | null>(null);

  /* Group mapping modal */
  const [showMappingModal,  setShowMappingModal]  = useState(false);
  const [editMapping,       setEditMapping]       = useState<GroupMapping | null>(null);

  /* Sync state */
  const [importingUsers,  setImportingUsers]  = useState(false);
  const [syncingGroups,   setSyncingGroups]   = useState(false);
  const [importResult,    setImportResult]    = useState<SyncResult | null>(null);
  const [syncResult,      setSyncResult]      = useState<SyncResult | null>(null);
  const [selectedProvider,setSelectedProvider]= useState<string>("");

  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => { setBaseUrl(window.location.origin); }, []);

  const loadAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [sRes, pRes, mRes] = await Promise.all([
        fetch("/api/protected/auth-settings"),
        fetch("/api/protected/identity-providers"),
        fetch("/api/protected/auth/group-mappings"),
      ]);
      if (!sRes.ok) throw new Error("Failed to load settings.");
      if (!pRes.ok) throw new Error("Failed to load providers.");
      const [s, p, m] = await Promise.all([sRes.json(), pRes.json(), mRes.json()]);
      setSettings({ ...DEFAULT_SETTINGS, ...s });
      const pList = Array.isArray(p) ? p : [];
      setProviders(pList);
      setMappings(Array.isArray(m?.data) ? m.data : Array.isArray(m) ? m : []);
      if (!selectedProvider && pList.length > 0) {
        const first = pList.find((p: IdentityProvider) => p.provider_type === "AZURE_AD" || p.provider_type === "LDAP");
        setSelectedProvider(first?.id ?? pList[0].id);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [selectedProvider]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSaveSettings = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res  = await fetch("/api/protected/auth-settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setSettings({ ...DEFAULT_SETTINGS, ...data });
      setSuccess("Authentication settings saved.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleToggleProvider = async (provider: IdentityProvider) => {
    try {
      const res = await fetch(`/api/protected/identity-providers/${provider.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !provider.enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle provider.");
      await loadAll();
    } catch (e) { setError((e as Error).message); }
  };

  const handleEditProvider = (p: IdentityProvider) => {
    if (p.provider_type === "LDAP") {
      setEditLdapProvider(p); setShowLdapModal(true);
    } else if (p.provider_type === "SAML") {
      setEditSamlProvider(p); setShowSamlModal(true);
    } else if (p.provider_type === "OIDC") {
      setEditOidcProvider(p); setShowOidcModal(true);
    } else {
      setEditAzureProvider(p); setShowAzureModal(true);
    }
  };

  const handleToggleMapping = async (mapping: GroupMapping) => {
    try {
      const res = await fetch(`/api/protected/auth/group-mappings/${mapping.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !mapping.enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle mapping.");
      await loadAll();
    } catch (e) { setError((e as Error).message); }
  };

  const handleImportUsers = async () => {
    if (!selectedProvider) { setError("Select a provider first."); return; }
    const prov = providers.find((p) => p.id === selectedProvider);
    setImportingUsers(true); setImportResult(null); setError("");
    try {
      const endpoint = prov?.provider_type === "LDAP"
        ? "/api/protected/auth/ldap/import-users"
        : "/api/protected/auth/azure/import-users";
      const res  = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: selectedProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setImportResult(data.data ?? data);
    } catch (e) { setError((e as Error).message); }
    finally { setImportingUsers(false); }
  };

  const handleSyncGroups = async () => {
    if (!selectedProvider) { setError("Select a provider first."); return; }
    const prov = providers.find((p) => p.id === selectedProvider);
    setSyncingGroups(true); setSyncResult(null); setError("");
    try {
      const endpoint = prov?.provider_type === "LDAP"
        ? "/api/protected/auth/ldap/sync-groups"
        : "/api/protected/auth/azure/sync-groups";
      const res  = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: selectedProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setSyncResult(data.data ?? data);
    } catch (e) { setError((e as Error).message); }
    finally { setSyncingGroups(false); }
  };

  const set = (key: keyof AuthSettings) => (val: boolean) =>
    setSettings((s) => ({ ...s, [key]: val }));

  const externalProviders = providers.filter((p) => p.provider_type === "AZURE_AD" || p.provider_type === "LDAP");
  const selectedProviderType = providers.find((p) => p.id === selectedProvider)?.provider_type ?? "AZURE_AD";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Modals */}
      {showAzureModal && (
        <AzureProviderModal
          editProvider={editAzureProvider} baseUrl={baseUrl}
          onClose={() => { setShowAzureModal(false); setEditAzureProvider(null); }}
          onSaved={() => { setShowAzureModal(false); setEditAzureProvider(null); loadAll(); }}
        />
      )}
      {showLdapModal && (
        <LdapProviderModal
          editProvider={editLdapProvider}
          onClose={() => { setShowLdapModal(false); setEditLdapProvider(null); }}
          onSaved={() => { setShowLdapModal(false); setEditLdapProvider(null); loadAll(); }}
        />
      )}
      {showSamlModal && (
        <SamlProviderModal
          editProvider={editSamlProvider}
          onClose={() => { setShowSamlModal(false); setEditSamlProvider(null); }}
          onSaved={() => { setShowSamlModal(false); setEditSamlProvider(null); loadAll(); }}
        />
      )}
      {showOidcModal && (
        <OidcProviderModal
          editProvider={editOidcProvider}
          onClose={() => { setShowOidcModal(false); setEditOidcProvider(null); }}
          onSaved={() => { setShowOidcModal(false); setEditOidcProvider(null); loadAll(); }}
        />
      )}
      {showMappingModal && (
        <GroupMappingModal
          editMapping={editMapping} providers={providers}
          onClose={() => { setShowMappingModal(false); setEditMapping(null); }}
          onSaved={() => { setShowMappingModal(false); setEditMapping(null); loadAll(); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/10 rounded-xl border border-blue-600/20">
            <ShieldCheck className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Authentication Settings</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>Manage identity providers and enterprise authentication configuration.</p>
          </div>
        </div>
        {activeTab === "methods" && (
          <button onClick={handleSaveSettings} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save Settings"}
          </button>
        )}
      </div>

      {error   && <div className="bg-red-50   border border-red-200   text-red-700   text-sm p-3 rounded-lg">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-lg">{success}</div>}

      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
        {([
          { key: "methods",   label: "Login Methods",      icon: ShieldCheck },
          { key: "providers", label: "Identity Providers", icon: Eye },
          { key: "groups",    label: "Group Mapping",      icon: GitMerge },
          { key: "help",      label: "Help",               icon: HelpCircle },
        ] as { key: ActiveTab; label: string; icon: (props: { className?: string }) => JSX.Element }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-150 ${
              activeTab === key
                ? "border-blue-500 text-blue-500"
                : "border-transparent hover:border-slate-300"
            }`}
            style={activeTab !== key ? { color: "var(--muted)" } : undefined}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Login Methods ─────────────────────────────────────────── */}
      {activeTab === "methods" && (
        <>
          <div className="rounded-xl shadow-sm border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>Login Methods</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>At least one method must remain enabled.</p>
            </div>
            <div className="px-6 py-2">
              <Toggle label="Enable Local Login"                description="Email + password stored in this system."                                 checked={settings.allow_local_login}  onChange={set("allow_local_login")} />
              <Toggle label="Enable Azure AD / Entra ID Login" description="Microsoft Azure Active Directory via OAuth 2.0 / OIDC."                  checked={settings.allow_azure_login}  onChange={set("allow_azure_login")} />
              <Toggle label="Enable Google Workspace Login"    description="Coming soon — Google Workspace OAuth 2.0."                               checked={settings.allow_google_login} onChange={set("allow_google_login")} />
              <Toggle label="Enable LDAP / AD Login"           description="On-premise Active Directory or LDAP directory server."                  checked={settings.allow_ldap_login}   onChange={set("allow_ldap_login")} />
              <Toggle label="Enable SAML Login"                description="SAML 2.0 enterprise SSO — Okta, Auth0, Keycloak, and other IdPs."      checked={settings.allow_saml_login}   onChange={set("allow_saml_login")} />
              <Toggle label="Enable OIDC Login"                description="Generic OpenID Connect SSO — Okta, Auth0, Google Workspace, and more."  checked={settings.allow_oidc_login}   onChange={set("allow_oidc_login")} />
            </div>
          </div>

          <div className="rounded-xl shadow-sm border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>User Sync Options</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Automatic provisioning and de-provisioning.</p>
            </div>
            <div className="px-6 py-2">
              <Toggle label="Auto Import External Users" description="Automatically create accounts for verified external users on first login." checked={settings.auto_import_external_users} onChange={set("auto_import_external_users")} />
              <Toggle label="Auto Disable Removed Users" description="Automatically disable users removed from the external identity provider."   checked={settings.auto_disable_removed_users} onChange={set("auto_disable_removed_users")} />
            </div>
          </div>

          {/* Info card pointing to Help tab */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-6 flex items-start gap-4">
            <div className="p-2.5 bg-blue-600/10 rounded-xl border border-blue-600/20 shrink-0">
              <HelpCircle className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-1">Setup Instructions</h3>
              <p className="text-sm text-blue-600 dark:text-blue-500">
                Step-by-step configuration guides for Azure AD, Google Workspace, LDAP, SAML, and OIDC are available in the{" "}
                <button
                  onClick={() => setActiveTab("help")}
                  className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  Help tab
                </button>
                .
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── Tab: Identity Providers ────────────────────────────────────── */}
      {activeTab === "providers" && (
        <div className="rounded-xl shadow-sm border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>Identity Providers</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Configured external authentication providers.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setEditLdapProvider(null); setShowLdapModal(true); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50">
                <Server className="h-3.5 w-3.5" /> Add LDAP
              </button>
              <button onClick={() => { setEditSamlProvider(null); setShowSamlModal(true); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-indigo-300 text-indigo-700 text-xs font-medium rounded-lg hover:bg-indigo-50">
                <Plus className="h-3.5 w-3.5" /> Add SAML
              </button>
              <button onClick={() => { setEditOidcProvider(null); setShowOidcModal(true); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-sky-300 text-sky-700 text-xs font-medium rounded-lg hover:bg-sky-50">
                <Plus className="h-3.5 w-3.5" /> Add OIDC
              </button>
              <button onClick={() => { setEditAzureProvider(null); setShowAzureModal(true); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
                <Plus className="h-3.5 w-3.5" /> Add Azure AD
              </button>
            </div>
          </div>

          {providers.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <ShieldCheck className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--border)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>No identity providers configured</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)", opacity: 0.7 }}>Add Azure AD or LDAP to enable external authentication.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y" style={{ borderColor: "var(--border)" }}>
                <thead style={{ background: "var(--bg)" }}>
                  <tr>
                    {["Name", "Provider", "Details", "Status", "Created", "Actions"].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {providers.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="px-6 py-4 text-sm font-medium" style={{ color: "var(--text)" }}>{p.name}</td>
                      <td className="px-6 py-4 text-sm" style={{ color: "var(--muted)" }}>{PROVIDER_LABEL[p.provider_type] ?? p.provider_type}</td>
                      <td className="px-6 py-4 text-sm font-mono" style={{ color: "var(--muted)" }}>
                        {p.provider_type === "LDAP"
                          ? (p.ldap_url ? p.ldap_url.replace(/^ldaps?:\/\//, "").split(":")[0].slice(0, 24) : "—")
                          : p.provider_type === "SAML"
                          ? (p.saml_entry_point ? p.saml_entry_point.replace(/^https?:\/\//, "").slice(0, 24) + "…" : "—")
                          : p.provider_type === "OIDC"
                          ? (p.oidc_issuer_url ? p.oidc_issuer_url.replace(/^https?:\/\//, "").slice(0, 24) + "…" : "—")
                          : (p.tenant_id ? `${p.tenant_id.slice(0, 8)}…` : "—")}
                      </td>
                      <td className="px-6 py-4"><StatusBadge enabled={p.enabled} /></td>
                      <td className="px-6 py-4 text-sm text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button title="Edit" onClick={() => handleEditProvider(p)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button title={p.enabled ? "Disable" : "Enable"} onClick={() => handleToggleProvider(p)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
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
      )}

      {/* ── Tab: Group Mapping ─────────────────────────────────────────── */}
      {activeTab === "help" && <HelpTab baseUrl={baseUrl} />}

      {activeTab === "groups" && (
        <div className="space-y-6">
          {/* Provider selector + sync actions */}
          <div className="rounded-xl shadow-sm border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text)" }}>Identity Provider</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="block w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
                >
                  <option value="">Select provider…</option>
                  {externalProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({PROVIDER_LABEL[p.provider_type] ?? p.provider_type}){!p.enabled ? " (disabled)" : ""}
                    </option>
                  ))}
                </select>
                {externalProviders.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">No Azure AD or LDAP providers configured. Add one in the Identity Providers tab.</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={handleImportUsers} disabled={importingUsers || !selectedProvider}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50">
                  {importingUsers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {importingUsers ? "Importing…" : `Import ${selectedProviderType === "LDAP" ? "LDAP" : "Azure"} Users`}
                </button>
                <button onClick={handleSyncGroups} disabled={syncingGroups || !selectedProvider}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50">
                  {syncingGroups ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  {syncingGroups ? "Syncing…" : `Sync ${selectedProviderType === "LDAP" ? "LDAP" : "Azure"} Groups`}
                </button>
              </div>
            </div>

            {/* Import result */}
            {importResult && (
              <div className={`mt-4 p-4 rounded-lg border text-sm ${importResult.errors.length > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                <div className="flex items-center gap-2 font-medium mb-2">
                  <Users className="h-4 w-4" />
                  User Import Result
                </div>
                <div className="grid grid-cols-3 gap-4 text-center mb-2">
                  <div className="bg-white rounded-lg p-2 border border-slate-100">
                    <div className="text-lg font-bold text-green-600">{importResult.imported ?? 0}</div>
                    <div className="text-xs text-slate-500">Imported</div>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-slate-100">
                    <div className="text-lg font-bold text-blue-600">{importResult.updated ?? 0}</div>
                    <div className="text-xs text-slate-500">Updated</div>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-slate-100">
                    <div className="text-lg font-bold text-slate-500">{importResult.skipped ?? 0}</div>
                    <div className="text-xs text-slate-500">Skipped</div>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="text-xs text-amber-700 space-y-1">
                    {importResult.errors.slice(0, 5).map((e, i) => <div key={i}>⚠ {e}</div>)}
                    {importResult.errors.length > 5 && <div>…and {importResult.errors.length - 5} more errors</div>}
                  </div>
                )}
              </div>
            )}

            {/* Group sync result */}
            {syncResult && (
              <div className={`mt-4 p-4 rounded-lg border text-sm ${syncResult.errors.length > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                <div className="flex items-center gap-2 font-medium mb-2">
                  <GitMerge className="h-4 w-4" />
                  Group Sync Result
                </div>
                <div className="grid grid-cols-2 gap-4 text-center mb-2">
                  <div className="bg-white rounded-lg p-2 border border-slate-100">
                    <div className="text-lg font-bold text-blue-600">{syncResult.synced ?? 0}</div>
                    <div className="text-xs text-slate-500">Groups Synced</div>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-slate-100">
                    <div className="text-lg font-bold text-green-600">{syncResult.usersMapped ?? 0}</div>
                    <div className="text-xs text-slate-500">Users Mapped</div>
                  </div>
                </div>
                {syncResult.errors.length > 0 && (
                  <div className="text-xs text-amber-700 space-y-1">
                    {syncResult.errors.slice(0, 5).map((e, i) => <div key={i}>⚠ {e}</div>)}
                    {syncResult.errors.length > 5 && <div>…and {syncResult.errors.length - 5} more errors</div>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Group Mappings table */}
          <div className="rounded-xl shadow-sm border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>Group → Role Mappings</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Map directory groups to application roles. Roles are assigned automatically on login.</p>
              </div>
              <button onClick={() => { setEditMapping(null); setShowMappingModal(true); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
                <Plus className="h-3.5 w-3.5" /> Add Mapping
              </button>
            </div>

            {mappings.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <GitMerge className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--border)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>No group mappings configured</p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)", opacity: 0.7 }}>Add a mapping to automatically assign roles based on group membership.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y" style={{ borderColor: "var(--border)" }}>
                  <thead style={{ background: "var(--bg)" }}>
                    <tr>
                      {["Group Name", "Group ID / DN", "Provider", "App Role", "Auto Assign", "Status", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {mappings.map((m) => (
                      <tr key={m.id} className="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text)" }}>{m.external_group_name}</td>
                        <td className="px-4 py-3 text-xs font-mono max-w-[160px] truncate" style={{ color: "var(--muted)" }} title={m.external_group_id}>
                          {m.external_group_id.length > 20 ? `${m.external_group_id.slice(0, 20)}…` : m.external_group_id}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{m.identity_provider.name}</td>
                        <td className="px-4 py-3">
                          {m.app_role ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {ROLE_LABEL[m.app_role] ?? m.app_role}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">No role</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {m.auto_assign_role ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle className="h-3 w-3" /> Yes</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400"><XCircle className="h-3 w-3" /> No</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge enabled={m.enabled} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button title="Edit" onClick={() => { setEditMapping(m); setShowMappingModal(true); }}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button title={m.enabled ? "Disable" : "Enable"} onClick={() => handleToggleMapping(m)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                              {m.enabled ? <Ban className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-xs text-blue-700 space-y-1.5">
            <p className="font-semibold text-blue-800 text-sm mb-2">How Group Mapping Works</p>
            <p>• <strong>Import Users</strong> pulls users from Azure AD or LDAP and creates/updates accounts here.</p>
            <p>• <strong>Sync Groups</strong> fetches group memberships and stores them on each user. Roles from active auto-assign mappings are applied immediately.</p>
            <p>• On every <strong>external login</strong>, the user&apos;s group memberships are checked against active mappings — the highest-privilege matching role is applied automatically.</p>
            <p>• <strong>Local users</strong> are never modified by import or sync operations.</p>
            <p>• For LDAP, the <strong>Group ID / DN</strong> field should be the full Distinguished Name of the group (e.g. <code className="bg-blue-100 px-1 rounded">CN=Admins,OU=Groups,DC=example,DC=com</code>).</p>
          </div>
        </div>
      )}
    </div>
  );
}

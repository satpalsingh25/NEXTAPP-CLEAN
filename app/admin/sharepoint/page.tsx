"use client";

import { useEffect, useState } from "react";
import {
  Cloud, Key, Link2, Library, Building2,
  Save, Wifi, RefreshCw, CheckCircle2, AlertCircle, Eye, EyeOff,
} from "lucide-react";

interface SharePointForm {
  tenant_id:        string;
  client_id:        string;
  client_secret:    string;
  site_url:         string;
  document_library: string;
}

const DEFAULT_FORM: SharePointForm = {
  tenant_id:        "",
  client_id:        "",
  client_secret:    "",
  site_url:         "",
  document_library: "",
};

export default function SharePointConfigPage() {
  const [form,          setForm]         = useState<SharePointForm>(DEFAULT_FORM);
  const [loading,       setLoading]      = useState(true);
  const [saving,        setSaving]       = useState(false);
  const [testing,       setTesting]      = useState(false);
  const [saveMsg,       setSaveMsg]      = useState("");
  const [saveErr,       setSaveErr]      = useState("");
  const [testMsg,       setTestMsg]      = useState("");
  const [testErr,       setTestErr]      = useState("");
  const [hasExisting,   setHasExisting]  = useState(false);
  const [showSecret,    setShowSecret]   = useState(false);

  useEffect(() => {
    fetch("/api/admin/sharepoint", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.tenant_id) {
          setForm({
            tenant_id:        d.tenant_id        ?? "",
            client_id:        d.client_id        ?? "",
            client_secret:    d.client_secret    ?? "",
            site_url:         d.site_url         ?? "",
            document_library: d.document_library ?? "",
          });
          setHasExisting(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function set(field: keyof SharePointForm, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
    setSaveMsg(""); setSaveErr(""); setTestMsg(""); setTestErr("");
  }

  async function handleSave() {
    setSaving(true); setSaveMsg(""); setSaveErr("");
    try {
      const res  = await fetch("/api/admin/sharepoint", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) setSaveErr(json.error ?? "Failed to save.");
      else { setSaveMsg("Configuration saved successfully."); setHasExisting(true); }
    } catch { setSaveErr("Network error."); }
    finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true); setTestMsg(""); setTestErr("");
    try {
      const res  = await fetch("/api/admin/sharepoint/test", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({
          tenant_id:     form.tenant_id,
          client_id:     form.client_id,
          client_secret: form.client_secret,
        }),
      });
      const json = await res.json();
      if (json.success) setTestMsg("Connection OK");
      else setTestErr(`Failed: ${json.error ?? "Authentication failed."}`);
    } catch { setTestErr("Failed: Network error."); }
    finally { setTesting(false); }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-10 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const canTest = !!form.tenant_id && !!form.client_id && !!form.client_secret;
  const canSave = !!form.tenant_id && !!form.client_id && !!form.site_url && !!form.document_library &&
                  (hasExisting || !!form.client_secret);

  return (
    <div className="max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-600 text-white shadow-sm">
          <Cloud size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">SharePoint Configuration</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Connect to Microsoft SharePoint for document storage
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">

        {/* Section: Tenant */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 size={12} /> Azure AD
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tenant ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.tenant_id}
              onChange={(e) => set("tenant_id", e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              data-testid="input-tenant-id"
            />
          </div>
        </div>

        {/* Section: App Registration */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Key size={12} /> App Registration
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Client ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.client_id}
              onChange={(e) => set("client_id", e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              data-testid="input-client-id"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Client Secret {!hasExisting && <span className="text-red-500">*</span>}
              {hasExisting && (
                <span className="text-slate-400 font-normal ml-1">(leave blank to keep current)</span>
              )}
            </label>
            <div className="relative">
              <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showSecret ? "text" : "password"}
                value={form.client_secret}
                onChange={(e) => set("client_secret", e.target.value)}
                placeholder={hasExisting ? "••••••••••••" : "Enter client secret"}
                className="w-full pl-9 pr-10 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="input-client-secret"
              />
              <button
                type="button"
                onClick={() => setShowSecret((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                data-testid="btn-toggle-secret"
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Section: SharePoint Site */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Link2 size={12} /> SharePoint Site
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Site URL <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="url"
                value={form.site_url}
                onChange={(e) => set("site_url", e.target.value)}
                placeholder="https://yourorg.sharepoint.com/sites/yoursite"
                className="w-full pl-9 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="input-site-url"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Document Library <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Library size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={form.document_library}
                onChange={(e) => set("document_library", e.target.value)}
                placeholder="Documents"
                className="w-full pl-9 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="input-document-library"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 rounded-b-2xl space-y-3">

          {/* Status messages */}
          {saveMsg && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5" data-testid="msg-save-success">
              <CheckCircle2 size={14} /> {saveMsg}
            </div>
          )}
          {saveErr && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5" data-testid="msg-save-error">
              <AlertCircle size={14} /> {saveErr}
            </div>
          )}
          {testMsg && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5" data-testid="msg-test-success">
              <CheckCircle2 size={14} /> {testMsg}
            </div>
          )}
          {testErr && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5" data-testid="msg-test-error">
              <AlertCircle size={14} /> {testErr}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleTest}
              disabled={testing || saving || !canTest}
              title={!canTest ? "Enter Tenant ID, Client ID, and Client Secret to test" : "Test the OAuth connection"}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-slate-200 text-slate-700 bg-white rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              data-testid="btn-test-connection"
            >
              {testing ? <RefreshCw size={14} className="animate-spin" /> : <Wifi size={14} />}
              {testing ? "Testing…" : "Test Connection"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || testing || !canSave}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="btn-save"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

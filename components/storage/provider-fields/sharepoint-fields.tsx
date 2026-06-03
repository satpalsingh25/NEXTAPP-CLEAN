"use client";

import { useState, useEffect } from "react";
import {
  Cloud, Key, Link2, Library, Building2,
  Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Wifi,
} from "lucide-react";
import type { StorageProvider } from "../types";

interface SharePointForm {
  tenant_id:        string;
  client_id:        string;
  client_secret:    string;
  site_url:         string;
  document_library: string;
}

const EMPTY: SharePointForm = {
  tenant_id: "", client_id: "", client_secret: "",
  site_url: "", document_library: "",
};

interface SharePointFieldsProps {
  editProvider: StorageProvider | null;
}

export function SharePointFields({ editProvider: _ }: SharePointFieldsProps) {
  const [form,        setForm]        = useState<SharePointForm>(EMPTY);
  const [hasExisting, setHasExisting] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [showSecret,  setShowSecret]  = useState(false);

  const [saving,   setSaving]   = useState(false);
  const [saveOk,   setSaveOk]   = useState("");
  const [saveErr,  setSaveErr]  = useState("");

  const [testing,  setTesting]  = useState(false);
  const [testOk,   setTestOk]   = useState("");
  const [testErr,  setTestErr]  = useState("");

  /* Load existing SharePoint config on mount */
  useEffect(() => {
    fetch("/api/admin/sharepoint", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.tenant_id) {
          setForm({
            tenant_id:        d.tenant_id        ?? "",
            client_id:        d.client_id        ?? "",
            client_secret:    "",                     // never pre-fill secret
            site_url:         d.site_url          ?? "",
            document_library: d.document_library  ?? "",
          });
          setHasExisting(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(field: keyof SharePointForm, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
    setSaveOk(""); setSaveErr(""); setTestOk(""); setTestErr("");
  }

  async function handleSave() {
    setSaving(true); setSaveOk(""); setSaveErr("");
    try {
      const res  = await fetch("/api/admin/sharepoint", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveErr(json.error ?? "Failed to save.");
      } else {
        setSaveOk("SharePoint configuration saved.");
        setHasExisting(true);
        if (form.client_secret) setForm((p) => ({ ...p, client_secret: "" }));
      }
    } catch { setSaveErr("Network error."); }
    finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true); setTestOk(""); setTestErr("");
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
      if (json.success) setTestOk("Connection successful — SharePoint authenticated.");
      else setTestErr(`Failed: ${json.error ?? "Authentication failed."}`);
    } catch { setTestErr("Network error during test."); }
    finally { setTesting(false); }
  }

  const canTest = !!form.tenant_id && !!form.client_id && !!form.client_secret;
  const canSave = !!form.tenant_id && !!form.client_id && !!form.site_url &&
                  !!form.document_library && (hasExisting || !!form.client_secret);

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono " +
    "focus:outline-none focus:ring-2 focus:ring-[#0078d4] bg-white text-slate-800 " +
    "placeholder:text-slate-400";

  return (
    <div className="bg-[#0078d4]/5 border border-[#0078d4]/20 rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#0078d4]/15">
        <Cloud className="h-4 w-4 text-[#0078d4]" />
        <p className="text-xs font-semibold text-[#0078d4]">SharePoint Credentials</p>
        {hasExisting && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
            <CheckCircle2 className="h-3 w-3" /> Configured
          </span>
        )}
      </div>

      {loading ? (
        <div className="px-4 py-6 flex items-center gap-2 text-slate-400 text-xs">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading current configuration…
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">

          {/* Azure AD */}
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="h-3 w-3" /> Azure AD
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tenant ID <span className="text-red-400">*</span>
            </label>
            <input
              value={form.tenant_id}
              onChange={(e) => set("tenant_id", e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className={input}
            />
          </div>

          {/* App Registration */}
          <p className="pt-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Key className="h-3 w-3" /> App Registration
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Client ID <span className="text-red-400">*</span>
            </label>
            <input
              value={form.client_id}
              onChange={(e) => set("client_id", e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className={input}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Client Secret{" "}
              {hasExisting
                ? <span className="text-slate-400 font-normal">(leave blank to keep current)</span>
                : <span className="text-red-400">*</span>}
            </label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={form.client_secret}
                onChange={(e) => set("client_secret", e.target.value)}
                placeholder={hasExisting ? "••••••••••••" : "Enter client secret"}
                className={`${input} pr-9`}
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* SharePoint Site */}
          <p className="pt-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Link2 className="h-3 w-3" /> SharePoint Site
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Site URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={form.site_url}
              onChange={(e) => set("site_url", e.target.value)}
              placeholder="https://yourorg.sharepoint.com/sites/yoursite"
              className={input}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Document Library <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Library className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                value={form.document_library}
                onChange={(e) => set("document_library", e.target.value)}
                placeholder="Documents"
                className={`${input} pl-8`}
              />
            </div>
          </div>

          {/* Status messages */}
          {saveOk  && <StatusMsg ok   msg={saveOk}  />}
          {saveErr && <StatusMsg ok={false} msg={saveErr} />}
          {testOk  && <StatusMsg ok   msg={testOk}  />}
          {testErr && <StatusMsg ok={false} msg={testErr} />}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#0078d4]/15">
            <button
              type="button"
              disabled={testing || saving || !canTest}
              onClick={handleTest}
              title={!canTest ? "Enter Tenant ID, Client ID and Client Secret to test" : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {testing
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Wifi className="h-3 w-3" />}
              {testing ? "Testing…" : "Test Connection"}
            </button>
            <button
              type="button"
              disabled={saving || testing || !canSave}
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#0078d4] text-white hover:bg-[#005fa3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Cloud className="h-3 w-3" />}
              {saving ? "Saving…" : "Save SP Config"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusMsg({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs border ${
      ok
        ? "bg-green-50 border-green-200 text-green-700"
        : "bg-red-50 border-red-200 text-red-700"
    }`}>
      {ok
        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        : <AlertCircle  className="h-3.5 w-3.5 shrink-0" />}
      {msg}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  Mail, Server, Lock, User, AtSign, ShieldCheck,
  Save, Send, RefreshCw, CheckCircle2, AlertCircle, Eye, EyeOff,
} from "lucide-react";

interface SmtpForm {
  host:       string;
  port:       string;
  username:   string;
  password:   string;
  from_email: string;
  secure:     boolean;
  is_active:  boolean;
}

const DEFAULT_FORM: SmtpForm = {
  host:       "",
  port:       "587",
  username:   "",
  password:   "",
  from_email: "",
  secure:     false,
  is_active:  true,
};

export default function SmtpSettingsPage() {
  const [form,          setForm]          = useState<SmtpForm>(DEFAULT_FORM);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [testing,       setTesting]       = useState(false);
  const [saveMsg,       setSaveMsg]       = useState("");
  const [saveErr,       setSaveErr]       = useState("");
  const [testMsg,       setTestMsg]       = useState("");
  const [testErr,       setTestErr]       = useState("");
  const [showPassword,  setShowPassword]  = useState(false);
  const [hasExisting,   setHasExisting]   = useState(false);

  useEffect(() => {
    fetch("/api/admin/smtp", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.host) {
          setForm({
            host:       d.host       ?? "",
            port:       String(d.port ?? 587),
            username:   d.username   ?? "",
            password:   d.password   ?? "",
            from_email: d.from_email ?? "",
            secure:     d.secure     ?? false,
            is_active:  d.is_active  ?? true,
          });
          setHasExisting(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function set(field: keyof SmtpForm, value: string | boolean) {
    setForm((p) => ({ ...p, [field]: value }));
    setSaveMsg(""); setSaveErr(""); setTestMsg(""); setTestErr("");
  }

  async function handleSave() {
    setSaving(true); setSaveMsg(""); setSaveErr("");
    try {
      const res  = await fetch("/api/admin/smtp/save", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, port: Number(form.port) }),
      });
      const json = await res.json();
      if (!res.ok) setSaveErr(json.error ?? "Failed to save.");
      else { setSaveMsg(json.message ?? "Saved."); setHasExisting(true); }
    } catch { setSaveErr("Network error."); }
    finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true); setTestMsg(""); setTestErr("");
    try {
      const res  = await fetch("/api/admin/smtp/test", {
        method: "POST", credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) setTestErr(json.error ?? "Test failed.");
      else setTestMsg(json.message ?? "Test email sent.");
    } catch { setTestErr("Network error."); }
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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-600 text-white shadow-sm">
          <Mail size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">SMTP Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure outgoing email for notifications and alerts
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">

        {/* Section: Server */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Server size={12} /> Server
          </p>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                SMTP Host <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.host}
                onChange={(e) => set("host", e.target.value)}
                placeholder="smtp.example.com"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="input-smtp-host"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Port <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => set("port", e.target.value)}
                placeholder="587"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="input-smtp-port"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => set("secure", !form.secure)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.secure ? "bg-blue-600" : "bg-slate-200"
              }`}
              data-testid="toggle-smtp-secure"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full toggle-knob shadow transition-transform ${
                  form.secure ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <div>
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                <ShieldCheck size={13} className="text-blue-500" /> Secure (SSL/TLS)
              </p>
              <p className="text-xs text-slate-400">
                {form.secure ? "Enabled — use port 465" : "Disabled — use port 587 for STARTTLS"}
              </p>
            </div>
          </div>
        </div>

        {/* Section: Credentials */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Lock size={12} /> Credentials
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Username <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                placeholder="smtp-user@example.com"
                className="w-full pl-9 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="input-smtp-username"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password {!hasExisting && <span className="text-red-500">*</span>}
              {hasExisting && <span className="text-slate-400 font-normal ml-1">(leave blank to keep current)</span>}
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder={hasExisting ? "••••••••" : "Enter SMTP password"}
                className="w-full pl-9 pr-10 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="input-smtp-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                data-testid="btn-toggle-password"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Section: Sender */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <AtSign size={12} /> Sender
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              From Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={form.from_email}
                onChange={(e) => set("from_email", e.target.value)}
                placeholder="noreply@example.com"
                className="w-full pl-9 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="input-smtp-from-email"
              />
            </div>
          </div>
        </div>

        {/* Footer: messages + buttons */}
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
            <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5" data-testid="msg-test-success">
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
              disabled={testing || saving || !hasExisting}
              title={!hasExisting ? "Save configuration first" : "Send a test email to your account"}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-slate-200 text-slate-700 bg-white rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              data-testid="btn-test-email"
            >
              {testing ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              {testing ? "Sending…" : "Test Email"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || testing}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="btn-save-smtp"
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

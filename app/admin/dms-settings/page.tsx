"use client";

import { useEffect, useState } from "react";
import {
  HardDrive, FileStack, FolderPlus,
  Save, RefreshCw, CheckCircle2, AlertCircle,
} from "lucide-react";

interface DmsSettingsForm {
  max_file_size_mb:           number;
  max_files_per_upload:       number;
  allow_user_folder_creation: boolean;
}

const DEFAULT_FORM: DmsSettingsForm = {
  max_file_size_mb:           10,
  max_files_per_upload:       20,
  allow_user_folder_creation: false,
};

export default function DmsSettingsPage() {
  const [form,    setForm]    = useState<DmsSettingsForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");

  /* ── Load settings ───────────────────────────────────────────────────── */
  useEffect(() => {
    fetch("/api/admin/dms-settings", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.max_file_size_mb === "number") {
          setForm({
            max_file_size_mb:           d.max_file_size_mb,
            max_files_per_upload:       d.max_files_per_upload,
            allow_user_folder_creation: d.allow_user_folder_creation,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /* ── Handlers ────────────────────────────────────────────────────────── */
  function setNum(field: "max_file_size_mb" | "max_files_per_upload", raw: string) {
    const val = parseInt(raw, 10);
    setForm((p) => ({ ...p, [field]: isNaN(val) ? 0 : val }));
    setSaveMsg(""); setSaveErr("");
  }

  async function handleSave() {
    setSaving(true); setSaveMsg(""); setSaveErr("");
    try {
      const res  = await fetch("/api/admin/dms-settings", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) setSaveErr(json.error ?? "Failed to save.");
      else setSaveMsg("Settings saved successfully.");
    } catch { setSaveErr("Network error."); }
    finally { setSaving(false); }
  }

  /* ── Loading skeleton ────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-10 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-600 text-white shadow-sm">
          <HardDrive size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">DMS Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure document management system limits and permissions
          </p>
        </div>
      </div>

      {/* ── General settings card ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">

        {/* Upload Limits */}
        <div className="px-6 py-5 space-y-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <FileStack size={12} /> Upload Limits
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Maximum File Size (MB)
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={2048}
                value={form.max_file_size_mb}
                onChange={(e) => setNum("max_file_size_mb", e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="input-max-file-size"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">
                MB
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Maximum size allowed per uploaded file.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Maximum Files per Upload
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={form.max_files_per_upload}
              onChange={(e) => setNum("max_files_per_upload", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="input-max-files-per-upload"
            />
            <p className="mt-1 text-xs text-slate-400">Maximum number of files allowed in a single upload batch.</p>
          </div>
        </div>

        {/* Folder Permissions */}
        <div className="px-6 py-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-5">
            <FolderPlus size={12} /> Folder Permissions
          </p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Allow User Folder Creation</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Let regular users create their own folders in the DMS.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.allow_user_folder_creation}
              onClick={() => {
                setForm((p) => ({ ...p, allow_user_folder_creation: !p.allow_user_folder_creation }));
                setSaveMsg(""); setSaveErr("");
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                form.allow_user_folder_creation ? "bg-blue-600" : "bg-slate-200"
              }`}
              data-testid="toggle-allow-user-folder-creation"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full toggle-knob shadow-md transform transition-transform duration-200 ${
                  form.allow_user_folder_creation ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer — Save */}
        <div className="px-6 py-4 bg-slate-50 rounded-b-2xl space-y-3">
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
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
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

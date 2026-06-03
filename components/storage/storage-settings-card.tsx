"use client";

import { useState } from "react";
import { Loader2, CheckCircle, Settings2 } from "lucide-react";
import type { StorageProvider, StorageSettings } from "./types";
import { PROVIDER_META } from "./provider-meta";

interface StorageSettingsCardProps {
  settings:  StorageSettings | null;
  providers: StorageProvider[];
  onSaved:   () => void;
}

export function StorageSettingsCard({ settings, providers, onSaved }: StorageSettingsCardProps) {
  const [defaultProviderId, setDefaultProviderId] = useState(settings?.default_provider_id ?? "");
  const [autoCreate,        setAutoCreate]        = useState(settings?.auto_create_folder_structure ?? true);
  const [externalSharing,   setExternalSharing]   = useState(settings?.enable_external_sharing ?? false);
  const [saving,            setSaving]            = useState(false);
  const [saved,             setSaved]             = useState(false);
  const [error,             setError]             = useState("");

  /* Sync when settings prop changes (e.g. after parent reload) */
  const [prevSettings, setPrevSettings] = useState(settings);
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setDefaultProviderId(settings?.default_provider_id ?? "");
    setAutoCreate(settings?.auto_create_folder_structure ?? true);
    setExternalSharing(settings?.enable_external_sharing ?? false);
  }

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/protected/storage/settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          default_provider_id:          defaultProviderId || null,
          auto_create_folder_structure: autoCreate,
          enable_external_sharing:      externalSharing,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Save failed."); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-50 rounded-lg">
            <Settings2 className="h-4 w-4 text-slate-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Company Storage Settings</h2>
            <p className="text-xs text-slate-500 mt-0.5">Global storage preferences for this company.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors shrink-0"
        >
          {saving ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
          ) : saved ? (
            <><CheckCircle className="h-3 w-3" /> Saved</>
          ) : "Save Settings"}
        </button>
      </div>

      <div className="px-6 py-5 space-y-5">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Default Provider */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Default Storage Provider</label>
          <select
            value={defaultProviderId}
            onChange={(e) => setDefaultProviderId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">— None (use SharePoint settings) —</option>
            {providers.filter((p) => p.enabled).map((p) => (
              <option key={p.id} value={p.id}>
                {PROVIDER_META[p.provider_type].label} — {p.name}{p.is_default ? " ★" : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            The provider used when no specific provider is selected for an upload.
          </p>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Toggle
            label="Auto-create Folder Structure"
            description="Automatically create company/module folders on the provider."
            value={autoCreate}
            onChange={setAutoCreate}
          />
          <Toggle
            label="Enable External Sharing"
            description="Allow generating shareable links for files."
            value={externalSharing}
            onChange={setExternalSharing}
          />
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label, description, value, onChange,
}: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 bg-slate-50 rounded-xl px-4 py-3 cursor-pointer select-none">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <div
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? "bg-blue-600" : "bg-slate-200"}`}
      >
        <div className={`absolute top-1 w-4 h-4 toggle-knob rounded-full shadow transition-all ${value ? "left-6" : "left-1"}`} />
      </div>
    </label>
  );
}

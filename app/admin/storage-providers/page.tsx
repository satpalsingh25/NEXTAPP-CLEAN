"use client";

import { useEffect, useState, useCallback } from "react";
import {
  HardDrive, Plus, X, Loader2, CheckCircle, XCircle,
  Pencil, Ban, Eye, RefreshCw, Star, StarOff, Zap,
  Cloud, Server, Database, Box,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────────────── */
type ProviderType = "SHAREPOINT" | "GOOGLE_DRIVE" | "AWS_S3" | "AZURE_BLOB";

interface StorageProvider {
  id: string;
  name: string;
  provider_type: ProviderType;
  enabled: boolean;
  is_default: boolean;
  configuration_json: Record<string, unknown> | null;
  provider_identifier: string | null;
  created_at: string;
  updated_at: string;
}

interface StorageSettings {
  id: string;
  company_id: string;
  default_provider_id: string | null;
  auto_create_folder_structure: boolean;
  enable_external_sharing: boolean;
}

/* ── Provider meta ───────────────────────────────────────────────────── */
const PROVIDER_META: Record<ProviderType, { label: string; icon: React.ReactNode; color: string; bg: string; description: string }> = {
  SHAREPOINT: {
    label: "SharePoint",
    icon: <Cloud className="h-5 w-5" />,
    color: "text-[#0078d4]",
    bg: "bg-[#0078d4]/10",
    description: "Microsoft SharePoint / OneDrive via Graph API",
  },
  GOOGLE_DRIVE: {
    label: "Google Drive",
    icon: <HardDrive className="h-5 w-5" />,
    color: "text-[#1a73e8]",
    bg: "bg-[#1a73e8]/10",
    description: "Google Drive via Google Drive API",
  },
  AWS_S3: {
    label: "AWS S3",
    icon: <Box className="h-5 w-5" />,
    color: "text-[#ff9900]",
    bg: "bg-[#ff9900]/10",
    description: "Amazon S3 object storage",
  },
  AZURE_BLOB: {
    label: "Azure Blob",
    icon: <Database className="h-5 w-5" />,
    color: "text-[#0089d6]",
    bg: "bg-[#0089d6]/10",
    description: "Azure Blob Storage",
  },
};

const IMPLEMENTED = new Set<ProviderType>(["SHAREPOINT"]);

/* ── Add / Edit Modal ───────────────────────────────────────────────── */
interface ProviderModalProps {
  editProvider: StorageProvider | null;
  onClose: () => void;
  onSaved: () => void;
}

function ProviderModal({ editProvider, onClose, onSaved }: ProviderModalProps) {
  const [name,              setName]             = useState(editProvider?.name ?? "");
  const [providerType,      setProviderType]      = useState<ProviderType>(editProvider?.provider_type ?? "SHAREPOINT");
  const [providerIdentifier,setProviderIdentifier]= useState(editProvider?.provider_identifier ?? "");
  const [isDefault,         setIsDefault]         = useState(editProvider?.is_default ?? false);
  const [saving,            setSaving]            = useState(false);
  const [error,             setError]             = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Name is required."); return; }

    setSaving(true);
    try {
      const url    = editProvider
        ? `/api/protected/storage/providers/${editProvider.id}`
        : "/api/protected/storage/providers";
      const method = editProvider ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          provider_type: providerType,
          provider_identifier: providerIdentifier.trim() || null,
          is_default: isDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed."); return; }
      onSaved();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">
            {editProvider ? "Edit Storage Provider" : "Add Storage Provider"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <XCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* Provider type — only for new providers */}
          {!editProvider && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Provider Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(PROVIDER_META) as [ProviderType, typeof PROVIDER_META[ProviderType]][]).map(([type, meta]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setProviderType(type)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
                      providerType === type
                        ? `border-blue-500 ${meta.bg} ${meta.color} font-medium`
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span className={providerType === type ? meta.color : "text-slate-400"}>{meta.icon}</span>
                    {meta.label}
                    {!IMPLEMENTED.has(type) && (
                      <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 px-1 rounded">Soon</span>
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{PROVIDER_META[providerType].description}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Display Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g. Production ${PROVIDER_META[providerType].label}`}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Provider Identifier (optional) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Identifier <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              value={providerIdentifier}
              onChange={(e) => setProviderIdentifier(e.target.value)}
              placeholder={
                providerType === "SHAREPOINT" ? "e.g. tenant-name.sharepoint.com"
                : providerType === "AWS_S3"   ? "e.g. my-bucket-name"
                : providerType === "AZURE_BLOB" ? "e.g. mystorageaccount"
                : "e.g. shared-drive-id"
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Set as default */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setIsDefault((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isDefault ? "bg-blue-600" : "bg-slate-200"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isDefault ? "left-5" : "left-0.5"}`} />
            </div>
            <span className="text-sm text-slate-700">Set as default provider</span>
          </label>

          {!IMPLEMENTED.has(providerType) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              <strong>{PROVIDER_META[providerType].label}</strong> is registered in the architecture but full
              configuration and uploads will be available in a future phase.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editProvider ? "Save Changes" : "Add Provider"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function StorageProvidersPage() {
  const [providers,    setProviders]    = useState<StorageProvider[]>([]);
  const [settings,     setSettings]    = useState<StorageSettings | null>(null);
  const [loading,      setLoading]     = useState(true);
  const [error,        setError]       = useState("");
  const [showModal,    setShowModal]   = useState(false);
  const [editProvider, setEditProvider]= useState<StorageProvider | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved]   = useState(false);
  const [testingId,    setTestingId]   = useState<string | null>(null);
  const [testResult,   setTestResult]  = useState<{ id: string; ok: boolean; message: string } | null>(null);
  const [actionError,  setActionError] = useState("");

  const [draftSettings, setDraftSettings] = useState<{
    default_provider_id: string;
    auto_create_folder_structure: boolean;
    enable_external_sharing: boolean;
  }>({ default_provider_id: "", auto_create_folder_structure: true, enable_external_sharing: false });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/protected/storage/providers"),
        fetch("/api/protected/storage/settings"),
      ]);
      if (!pRes.ok || !sRes.ok) throw new Error("Failed to load storage data.");
      const pData = await pRes.json();
      const sData = await sRes.json();
      const provList: StorageProvider[] = pData.data ?? pData;
      const sett: StorageSettings       = sData.data ?? sData;
      setProviders(provList);
      setSettings(sett);
      setDraftSettings({
        default_provider_id:          sett.default_provider_id ?? "",
        auto_create_folder_structure: sett.auto_create_folder_structure,
        enable_external_sharing:      sett.enable_external_sharing,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setActionError("");
    try {
      const res = await fetch("/api/protected/storage/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_provider_id:          draftSettings.default_provider_id || null,
          auto_create_folder_structure: draftSettings.auto_create_folder_structure,
          enable_external_sharing:      draftSettings.enable_external_sharing,
        }),
      });
      if (!res.ok) { const d = await res.json(); setActionError(d.error ?? "Save failed."); return; }
      await load();
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch {
      setActionError("Network error.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggle = async (provider: StorageProvider) => {
    setActionError("");
    try {
      const res = await fetch(`/api/protected/storage/providers/${provider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !provider.enabled }),
      });
      if (!res.ok) { const d = await res.json(); setActionError(d.error ?? "Action failed."); return; }
      await load();
    } catch {
      setActionError("Network error.");
    }
  };

  const handleSetDefault = async (provider: StorageProvider) => {
    setActionError("");
    try {
      const res = await fetch(`/api/protected/storage/providers/${provider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) { const d = await res.json(); setActionError(d.error ?? "Action failed."); return; }
      await load();
    } catch {
      setActionError("Network error.");
    }
  };

  const handleTestConnection = async (provider: StorageProvider) => {
    setTestingId(provider.id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/protected/storage/providers/${provider.id}`, { method: "POST" });
      const data = await res.json();
      const result = data.data ?? data;
      setTestResult({ id: provider.id, ok: result.ok, message: result.message });
    } catch {
      setTestResult({ id: provider.id, ok: false, message: "Network error during test." });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl">
            <HardDrive className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Storage Providers</h1>
            <p className="text-sm text-slate-500 mt-0.5">Configure and manage file storage backends for your company.</p>
          </div>
        </div>
        <button onClick={() => { setEditProvider(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shrink-0">
          <Plus className="h-4 w-4" /> Add Provider
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <XCircle className="h-4 w-4 shrink-0" /> {error}
          <button onClick={load} className="ml-auto flex items-center gap-1 text-red-600 hover:text-red-800">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <XCircle className="h-4 w-4 shrink-0" /> {actionError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Section A: Company Storage Settings ─────────────────── */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Company Storage Settings</h2>
                <p className="text-xs text-slate-500 mt-0.5">Global storage preferences for this company.</p>
              </div>
              <button onClick={handleSaveSettings} disabled={savingSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors">
                {savingSettings
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                  : settingsSaved
                    ? <><CheckCircle className="h-3 w-3" /> Saved</>
                    : "Save Settings"}
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Default Provider */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Default Storage Provider</label>
                <select
                  value={draftSettings.default_provider_id}
                  onChange={(e) => setDraftSettings((d) => ({ ...d, default_provider_id: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— None (use SharePoint settings) —</option>
                  {providers.filter((p) => p.enabled).map((p) => (
                    <option key={p.id} value={p.id}>
                      {PROVIDER_META[p.provider_type].label} — {p.name}
                      {p.is_default ? " ★" : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">The provider used when no specific provider is selected for an upload.</p>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center justify-between gap-4 bg-slate-50 rounded-xl px-4 py-3 cursor-pointer select-none">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Auto-create Folder Structure</p>
                    <p className="text-xs text-slate-500 mt-0.5">Automatically create company/module folders on the provider.</p>
                  </div>
                  <div
                    onClick={() => setDraftSettings((d) => ({ ...d, auto_create_folder_structure: !d.auto_create_folder_structure }))}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${draftSettings.auto_create_folder_structure ? "bg-blue-600" : "bg-slate-200"}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${draftSettings.auto_create_folder_structure ? "left-6" : "left-1"}`} />
                  </div>
                </label>

                <label className="flex items-center justify-between gap-4 bg-slate-50 rounded-xl px-4 py-3 cursor-pointer select-none">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Enable External Sharing</p>
                    <p className="text-xs text-slate-500 mt-0.5">Allow generating shareable links for files.</p>
                  </div>
                  <div
                    onClick={() => setDraftSettings((d) => ({ ...d, enable_external_sharing: !d.enable_external_sharing }))}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${draftSettings.enable_external_sharing ? "bg-blue-600" : "bg-slate-200"}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${draftSettings.enable_external_sharing ? "left-6" : "left-1"}`} />
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* ── Section B: Storage Providers Table ──────────────────── */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Registered Providers</h2>
                <p className="text-xs text-slate-500 mt-0.5">{providers.length} provider{providers.length !== 1 ? "s" : ""} configured.</p>
              </div>
            </div>

            {providers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 bg-slate-100 rounded-2xl mb-4">
                  <HardDrive className="h-10 w-10 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-600">No storage providers configured</p>
                <p className="text-xs text-slate-400 mt-1">Click <strong>Add Provider</strong> to register your first storage backend.</p>
                <button onClick={() => { setEditProvider(null); setShowModal(true); }}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700">
                  <Plus className="h-4 w-4" /> Add Provider
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="px-6 py-3 text-left">Name / Provider</th>
                      <th className="px-6 py-3 text-left">Status</th>
                      <th className="px-6 py-3 text-left">Default</th>
                      <th className="px-6 py-3 text-left">Created</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {providers.map((p) => {
                      const meta = PROVIDER_META[p.provider_type];
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          {/* Name / Provider */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${meta.bg} ${meta.color}`}>{meta.icon}</div>
                              <div>
                                <p className="font-medium text-slate-800">{p.name}</p>
                                <p className="text-xs text-slate-500">{meta.label}</p>
                                {p.provider_identifier && (
                                  <p className="text-xs text-slate-400 font-mono mt-0.5">{p.provider_identifier}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                              p.enabled
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-100 text-slate-500"
                            }`}>
                              {p.enabled ? <CheckCircle className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                              {p.enabled ? "Active" : "Disabled"}
                            </span>
                          </td>

                          {/* Default */}
                          <td className="px-6 py-4">
                            {p.is_default ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                <Star className="h-3 w-3" /> Default
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>

                          {/* Created */}
                          <td className="px-6 py-4 text-xs text-slate-500">
                            {new Date(p.created_at).toLocaleDateString()}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-1">
                              {/* Test */}
                              <button
                                title="Test Connection"
                                onClick={() => handleTestConnection(p)}
                                disabled={testingId === p.id}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                              >
                                {testingId === p.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Zap className="h-4 w-4" />}
                              </button>

                              {/* Set Default */}
                              {!p.is_default && (
                                <button
                                  title="Set as Default"
                                  onClick={() => handleSetDefault(p)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                >
                                  <StarOff className="h-4 w-4" />
                                </button>
                              )}

                              {/* Edit */}
                              <button
                                title="Edit"
                                onClick={() => { setEditProvider(p); setShowModal(true); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>

                              {/* Enable / Disable */}
                              <button
                                title={p.enabled ? "Disable" : "Enable"}
                                onClick={() => handleToggle(p)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  p.enabled
                                    ? "text-slate-400 hover:text-red-600 hover:bg-red-50"
                                    : "text-slate-400 hover:text-green-600 hover:bg-green-50"
                                }`}
                              >
                                {p.enabled ? <Ban className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Test result banner */}
            {testResult && (
              <div className={`mx-4 mb-4 flex items-start gap-2 px-4 py-3 rounded-xl text-sm border ${
                testResult.ok
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}>
                {testResult.ok
                  ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                <div>
                  <p className="font-medium">{testResult.ok ? "Connection OK" : "Connection Failed"}</p>
                  <p className="text-xs mt-0.5 opacity-80">{testResult.message}</p>
                </div>
                <button onClick={() => setTestResult(null)} className="ml-auto text-inherit opacity-60 hover:opacity-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* ── Architecture Overview ────────────────────────────────── */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Provider Status</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(Object.entries(PROVIDER_META) as [ProviderType, typeof PROVIDER_META[ProviderType]][]).map(([type, meta]) => (
                <div key={type} className={`rounded-xl p-3 border ${IMPLEMENTED.has(type) ? "border-green-200 bg-green-50" : "border-slate-200 bg-white"}`}>
                  <div className={`${meta.color} mb-1.5`}>{meta.icon}</div>
                  <p className="text-xs font-semibold text-slate-700">{meta.label}</p>
                  <p className={`text-xs mt-0.5 ${IMPLEMENTED.has(type) ? "text-green-600" : "text-amber-600"}`}>
                    {IMPLEMENTED.has(type) ? "Available" : "Coming soon"}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 pt-1">
              All providers share the same interface. Configuration and upload support for Google Drive, AWS S3, and Azure Blob will be enabled in upcoming phases.
            </p>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <ProviderModal
          editProvider={editProvider}
          onClose={() => { setShowModal(false); setEditProvider(null); }}
          onSaved={() => { setShowModal(false); setEditProvider(null); load(); }}
        />
      )}
    </div>
  );
}

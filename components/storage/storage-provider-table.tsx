"use client";

import { useState } from "react";
import {
  Zap, Pencil, Ban, Eye, Star, StarOff, Loader2,
  CheckCircle, XCircle, X, HardDrive, Plus,
} from "lucide-react";
import { PROVIDER_META } from "./provider-meta";
import type { StorageProvider } from "./types";

interface StorageProviderTableProps {
  providers:      StorageProvider[];
  onAdd:          () => void;
  onEdit:         (p: StorageProvider) => void;
  onRefresh:      () => void;
}

export function StorageProviderTable({
  providers,
  onAdd,
  onEdit,
  onRefresh,
}: StorageProviderTableProps) {
  const [testingId,   setTestingId]   = useState<string | null>(null);
  const [testResult,  setTestResult]  = useState<{ id: string; ok: boolean; message: string } | null>(null);
  const [actionError, setActionError] = useState("");

  const handleTestConnection = async (p: StorageProvider) => {
    setTestingId(p.id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/protected/storage/providers/${p.id}`, { method: "POST" });
      const data = await res.json();
      const result = data.data ?? data;
      setTestResult({ id: p.id, ok: result.ok, message: result.message });
    } catch {
      setTestResult({ id: p.id, ok: false, message: "Network error during test." });
    } finally {
      setTestingId(null);
    }
  };

  const handleToggle = async (p: StorageProvider) => {
    setActionError("");
    try {
      const res = await fetch(`/api/protected/storage/providers/${p.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ enabled: !p.enabled }),
      });
      if (!res.ok) { const d = await res.json(); setActionError(d.error ?? "Action failed."); return; }
      onRefresh();
    } catch { setActionError("Network error."); }
  };

  const handleSetDefault = async (p: StorageProvider) => {
    setActionError("");
    try {
      const res = await fetch(`/api/protected/storage/providers/${p.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ is_default: true }),
      });
      if (!res.ok) { const d = await res.json(); setActionError(d.error ?? "Action failed."); return; }
      onRefresh();
    } catch { setActionError("Network error."); }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Registered Providers</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {providers.length} provider{providers.length !== 1 ? "s" : ""} configured.
          </p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700 transition-colors shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Add Provider
        </button>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div className="mx-4 mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-700">
          <XCircle className="h-4 w-4 shrink-0" /> {actionError}
          <button onClick={() => setActionError("")} className="ml-auto opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="p-4 bg-slate-100 rounded-2xl mb-4">
            <HardDrive className="h-10 w-10 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-600">No storage providers configured</p>
          <p className="text-xs text-slate-400 mt-1">
            Click <strong>Add Provider</strong> to register your first storage backend.
          </p>
          <button
            onClick={onAdd}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700"
          >
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
                    {/* Name / Type */}
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
                        {p.enabled
                          ? <CheckCircle className="h-3 w-3" />
                          : <Ban className="h-3 w-3" />}
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
                        {/* Test Connection */}
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
                          onClick={() => onEdit(p)}
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
          <button onClick={() => setTestResult(null)} className="ml-auto opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

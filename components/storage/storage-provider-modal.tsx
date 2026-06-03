"use client";

import { useState, useEffect } from "react";
import { X, Loader2, XCircle } from "lucide-react";
import { PROVIDER_META, IMPLEMENTED } from "./provider-meta";
import { SharePointFields }  from "./provider-fields/sharepoint-fields";
import { GoogleDriveFields } from "./provider-fields/google-drive-fields";
import { AwsS3Fields }       from "./provider-fields/aws-s3-fields";
import { AzureBlobFields }   from "./provider-fields/azure-blob-fields";
import type { StorageProvider, ProviderType } from "./types";

interface StorageProviderModalProps {
  providerType:  ProviderType;
  editProvider:  StorageProvider | null;  // null = create mode
  onClose:       () => void;
  onSaved:       () => void;
}

export function StorageProviderModal({
  providerType,
  editProvider,
  onClose,
  onSaved,
}: StorageProviderModalProps) {
  const meta      = PROVIDER_META[providerType];
  const isCreate  = !editProvider;

  /* ── Common fields ─────────────────────────────────────────────── */
  const [name,               setName]               = useState(editProvider?.name ?? "");
  const [providerIdentifier, setProviderIdentifier] = useState(editProvider?.provider_identifier ?? "");
  const [isDefault,          setIsDefault]          = useState(editProvider?.is_default ?? false);
  const [saving,             setSaving]             = useState(false);
  const [error,              setError]              = useState("");

  /* ── Google Drive fields ────────────────────────────────────────── */
  const [gdClientId,       setGdClientId]       = useState("");
  const [gdClientSecret,   setGdClientSecret]   = useState("");
  const [gdDriveId,        setGdDriveId]        = useState("");
  const [gdRootFolderId,   setGdRootFolderId]   = useState("");
  const [gdUseSharedDrive, setGdUseSharedDrive] = useState(false);
  const [gdConnected,      setGdConnected]      = useState(false);
  const [gdConnecting,     setGdConnecting]     = useState(false);

  /* Initialise GD fields from existing provider */
  useEffect(() => {
    if (editProvider?.provider_type === "GOOGLE_DRIVE" && editProvider.configuration_json) {
      const cfg = editProvider.configuration_json as Record<string, unknown>;
      setGdClientId(String(cfg.client_id       ?? ""));
      setGdDriveId(String(cfg.drive_id         ?? ""));
      setGdRootFolderId(String(cfg.root_folder_id ?? ""));
      setGdUseSharedDrive(Boolean(cfg.use_shared_drive));
      setGdConnected(!!cfg.has_refresh_token);
    }
  }, [editProvider]);

  /* ── Save ──────────────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Display name is required."); return; }

    setSaving(true);
    try {
      const url    = editProvider
        ? `/api/protected/storage/providers/${editProvider.id}`
        : "/api/protected/storage/providers";
      const method = editProvider ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        name:                name.trim(),
        provider_type:       providerType,
        provider_identifier: providerIdentifier.trim() || null,
        is_default:          isDefault,
      };

      if (providerType === "GOOGLE_DRIVE") {
        const gdConfig: Record<string, unknown> = {
          client_id:        gdClientId,
          drive_id:         gdDriveId       || null,
          root_folder_id:   gdRootFolderId  || null,
          use_shared_drive: gdUseSharedDrive,
        };
        if (gdClientSecret) gdConfig.client_secret = gdClientSecret;
        body.configuration_json = gdConfig;
      }

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
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

  /* ── Google OAuth connect ──────────────────────────────────────── */
  const handleGDConnect = async () => {
    if (!editProvider) return;
    setError("");
    setGdConnecting(true);
    try {
      const gdConfig: Record<string, unknown> = {
        client_id:        gdClientId,
        drive_id:         gdDriveId      || null,
        root_folder_id:   gdRootFolderId || null,
        use_shared_drive: gdUseSharedDrive,
      };
      if (gdClientSecret) gdConfig.client_secret = gdClientSecret;

      const saveRes = await fetch(`/api/protected/storage/providers/${editProvider.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ configuration_json: gdConfig }),
      });
      if (!saveRes.ok) {
        const d = await saveRes.json();
        setError(d.error ?? "Failed to save credentials before connecting.");
        setGdConnecting(false);
        return;
      }
      window.location.href = `/api/protected/storage/google/connect?provider_id=${editProvider.id}`;
    } catch {
      setError("Network error. Please try again.");
      setGdConnecting(false);
    }
  };

  /* ── Provider-specific fields section ─────────────────────────── */
  const renderProviderFields = () => {
    switch (providerType) {
      case "SHAREPOINT":
        return <SharePointFields editProvider={editProvider} />;
      case "GOOGLE_DRIVE":
        return (
          <GoogleDriveFields
            editProvider={editProvider}
            clientId={gdClientId}
            clientSecret={gdClientSecret}
            driveId={gdDriveId}
            rootFolderId={gdRootFolderId}
            useSharedDrive={gdUseSharedDrive}
            isConnected={gdConnected}
            connecting={gdConnecting}
            onClientIdChange={setGdClientId}
            onClientSecretChange={setGdClientSecret}
            onDriveIdChange={setGdDriveId}
            onRootFolderIdChange={setGdRootFolderId}
            onSharedDriveChange={setGdUseSharedDrive}
            onConnect={handleGDConnect}
          />
        );
      case "AWS_S3":
        return <AwsS3Fields />;
      case "AZURE_BLOB":
        return <AzureBlobFields />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${meta.bg} ${meta.color}`}>{meta.icon}</div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                {isCreate ? `Add ${meta.label} Provider` : `Edit ${meta.label} Provider`}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable form body ─────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                <XCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {/* Display Name */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Display Name <span className="text-red-400">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g. Production ${meta.label}`}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Identifier (optional) */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Identifier{" "}
                <span className="text-slate-400 font-normal">(optional — for reference only)</span>
              </label>
              <input
                value={providerIdentifier}
                onChange={(e) => setProviderIdentifier(e.target.value)}
                placeholder={
                  providerType === "SHAREPOINT"   ? "e.g. tenant.sharepoint.com"
                  : providerType === "AWS_S3"     ? "e.g. my-bucket-name"
                  : providerType === "AZURE_BLOB" ? "e.g. mystorageaccount"
                  : "e.g. optional label"
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
                <div className={`absolute top-0.5 w-4 h-4 toggle-knob rounded-full shadow transition-all ${isDefault ? "left-5" : "left-0.5"}`} />
              </div>
              <span className="text-sm text-slate-700">Set as default provider</span>
            </label>

            {/* Provider-specific section */}
            {renderProviderFields()}

            {/* Coming-soon warning */}
            {!IMPLEMENTED.has(providerType) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                <strong>{meta.label}</strong> uploads are not yet active. You can register the
                provider now; full support will be enabled in an upcoming release.
              </div>
            )}
          </div>

          {/* ── Sticky footer ─────────────────────────────────────────── */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0 bg-white rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isCreate ? "Add Provider" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

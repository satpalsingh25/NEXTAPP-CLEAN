"use client";

import { Info, ExternalLink, Loader2 } from "lucide-react";
import type { StorageProvider } from "../types";

export interface GoogleDriveFieldsProps {
  editProvider:         StorageProvider | null;
  clientId:             string;
  clientSecret:         string;
  driveId:              string;
  rootFolderId:         string;
  useSharedDrive:       boolean;
  isConnected:          boolean;
  connecting:           boolean;
  onClientIdChange:     (v: string) => void;
  onClientSecretChange: (v: string) => void;
  onDriveIdChange:      (v: string) => void;
  onRootFolderIdChange: (v: string) => void;
  onSharedDriveChange:  (v: boolean) => void;
  onConnect:            () => void;
}

export function GoogleDriveFields({
  editProvider,
  clientId,
  clientSecret,
  driveId,
  rootFolderId,
  useSharedDrive,
  isConnected,
  connecting,
  onClientIdChange,
  onClientSecretChange,
  onDriveIdChange,
  onRootFolderIdChange,
  onSharedDriveChange,
  onConnect,
}: GoogleDriveFieldsProps) {
  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono " +
    "focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white";

  return (
    <div className="bg-[#1a73e8]/5 border border-[#1a73e8]/20 rounded-xl px-4 py-4 space-y-3">
      <div className="flex items-center gap-2 text-[#1a73e8]">
        <Info className="h-4 w-4 shrink-0" />
        <p className="text-xs font-semibold">Google Drive OAuth 2.0 Credentials</p>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        Create a project in{" "}
        <a
          href="https://console.cloud.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1a73e8] underline"
        >
          Google Cloud Console
        </a>
        , enable the Drive API, create an OAuth 2.0 Client ID (type: Web application), and
        add this app&apos;s callback URL as an Authorised Redirect URI.
      </p>

      {/* Client ID */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Client ID</label>
        <input
          value={clientId}
          onChange={(e) => onClientIdChange(e.target.value)}
          placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
          className={input}
        />
      </div>

      {/* Client Secret */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Client Secret
          {editProvider && (
            <span className="text-slate-400 font-normal ml-1">(leave blank to keep current)</span>
          )}
        </label>
        <input
          type="password"
          value={clientSecret}
          onChange={(e) => onClientSecretChange(e.target.value)}
          placeholder={editProvider ? "••••••••" : "Paste your client secret"}
          className={input}
        />
      </div>

      {/* Use Shared Drive toggle */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div
          onClick={() => onSharedDriveChange(!useSharedDrive)}
          className={`relative w-9 h-5 rounded-full transition-colors ${useSharedDrive ? "bg-[#1a73e8]" : "bg-slate-200"}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${useSharedDrive ? "left-4" : "left-0.5"}`} />
        </div>
        <span className="text-xs text-slate-700">Use a Shared Drive</span>
      </label>

      {/* Shared Drive ID — only when shared drive enabled */}
      {useSharedDrive && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Shared Drive ID</label>
          <input
            value={driveId}
            onChange={(e) => onDriveIdChange(e.target.value)}
            placeholder="e.g. 0ANxxxxxxxxxxxxxxxxxxx"
            className={input}
          />
          <p className="mt-1 text-[10px] text-slate-400">
            Found in the Drive URL: drive.google.com/drive/u/0/folders/<em>DRIVE_ID</em>
          </p>
        </div>
      )}

      {/* Root Folder ID */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Root Folder ID{" "}
          <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          value={rootFolderId}
          onChange={(e) => onRootFolderIdChange(e.target.value)}
          placeholder="Leave blank to use Drive root"
          className={input}
        />
      </div>

      {/* Google Account connect — only for existing providers */}
      {editProvider && (
        <div className="pt-2 border-t border-[#1a73e8]/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-700">Google Account</p>
              {isConnected ? (
                <p className="text-xs text-green-600 mt-0.5">✓ Connected (refresh token stored)</p>
              ) : (
                <p className="text-xs text-amber-600 mt-0.5">
                  Not connected — click to authorise
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={connecting || !clientId}
              onClick={onConnect}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-[#1a73e8] text-white hover:bg-[#1558b0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {connecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              {isConnected ? "Reconnect" : "Connect Google Account"}
            </button>
          </div>
          {!clientId && (
            <p className="mt-1.5 text-[10px] text-slate-400">
              Enter a Client ID to enable the connect button.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

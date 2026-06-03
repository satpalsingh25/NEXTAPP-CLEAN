"use client";

import { useState, useEffect, useCallback } from "react";
import { HardDrive, HelpCircle, X, CheckCircle, XCircle, AlertCircle } from "lucide-react";

import { StorageSettingsCard }  from "@/components/storage/storage-settings-card";
import { StorageProviderTable } from "@/components/storage/storage-provider-table";
import { ProviderTypeSelector } from "@/components/storage/provider-type-selector";
import { StorageProviderModal } from "@/components/storage/storage-provider-modal";
import { StorageHelpTab }       from "@/components/storage/storage-help-tab";
import type { StorageProvider, StorageSettings, ProviderType } from "@/components/storage/types";

type Tab = "providers" | "help";

interface Banner {
  type:    "success" | "error" | "info";
  message: string;
}

export default function StorageProvidersPage() {
  /* ── Data ───────────────────────────────────────────────────── */
  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [settings,  setSettings]  = useState<StorageSettings | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState("");

  /* ── UI ─────────────────────────────────────────────────────── */
  const [tab,    setTab]    = useState<Tab>("providers");
  const [banner, setBanner] = useState<Banner | null>(null);

  /* ── Modal ──────────────────────────────────────────────────── */
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedType,     setSelectedType]     = useState<ProviderType | null>(null);
  const [editProvider,     setEditProvider]     = useState<StorageProvider | null>(null);
  const [showModal,        setShowModal]        = useState(false);

  /* ── Load ───────────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoadError("");
    try {
      const [prvRes, setRes] = await Promise.all([
        fetch("/api/protected/storage/providers"),
        fetch("/api/protected/storage/settings"),
      ]);
      if (prvRes.ok) {
        const d = await prvRes.json();
        setProviders(Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []);
      }
      if (setRes.ok) {
        const d = await setRes.json();
        setSettings(d.data ?? d);
      }
    } catch {
      setLoadError("Failed to load storage data. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── OAuth redirect banners ─────────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp          = new URLSearchParams(window.location.search);
    const connected   = sp.get("gd_connected");
    const gdError     = sp.get("gd_error");
    if (connected === "true") {
      setBanner({ type: "success", message: "Google account connected successfully. The refresh token has been saved." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (gdError) {
      const msgs: Record<string, string> = {
        no_provider_id:  "No provider ID in the OAuth state.",
        no_code:         "Google did not return an authorisation code.",
        exchange_failed: "Token exchange with Google failed. Please try again.",
        save_failed:     "Connected to Google but failed to save the refresh token.",
        missing_config:  "Provider credentials missing. Please save Client ID and Secret first.",
      };
      setBanner({ type: "error", message: msgs[gdError] ?? `OAuth error: ${gdError}` });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  /* ── Modal helpers ──────────────────────────────────────────── */
  const handleAddProvider = () => setShowTypeSelector(true);

  const handleTypeSelected = (type: ProviderType) => {
    setSelectedType(type);
    setEditProvider(null);
    setShowTypeSelector(false);
    setShowModal(true);
  };

  const handleEditProvider = (p: StorageProvider) => {
    setEditProvider(p);
    setSelectedType(p.provider_type);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditProvider(null);
    setSelectedType(null);
  };

  const handleModalSaved = () => {
    handleModalClose();
    loadData();
    setBanner({ type: "success", message: "Storage provider saved successfully." });
    setTimeout(() => setBanner(null), 3500);
  };

  /* ── Banner config ──────────────────────────────────────────── */
  const bannerStyles: Record<Banner["type"], string> = {
    success: "bg-green-50 border-green-200 text-green-800",
    error:   "bg-red-50   border-red-200   text-red-800",
    info:    "bg-blue-50  border-blue-200  text-blue-800",
  };

  const BannerIcon = ({ type }: { type: Banner["type"] }) =>
    type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" />
    : type === "error"  ? <XCircle     className="h-4 w-4 shrink-0" />
    :                     <AlertCircle className="h-4 w-4 shrink-0" />;

  /* ── Tab config ─────────────────────────────────────────────── */
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "providers", label: "Providers", icon: <HardDrive className="h-4 w-4" /> },
    { id: "help",      label: "Help",      icon: <HelpCircle className="h-4 w-4" /> },
  ];

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">

      {/* Page heading */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-50 rounded-xl">
          <HardDrive className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Storage Providers</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage cloud storage backends used for document uploads.
          </p>
        </div>
      </div>

      {/* Global banner */}
      {banner && (
        <div className={`flex items-start gap-2 border rounded-xl px-4 py-3 text-sm ${bannerStyles[banner.type]}`}>
          <BannerIcon type={banner.type} />
          <span className="flex-1">{banner.message}</span>
          <button onClick={() => setBanner(null)} className="opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Load error */}
      {loadError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <XCircle className="h-4 w-4 shrink-0" /> {loadError}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl h-36 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Providers tab ─────────────────────────────── */}
          {tab === "providers" && (
            <div className="space-y-4 sm:space-y-6">
              <StorageSettingsCard
                settings={settings}
                providers={providers}
                onSaved={loadData}
              />
              <StorageProviderTable
                providers={providers}
                onAdd={handleAddProvider}
                onEdit={handleEditProvider}
                onRefresh={loadData}
              />
            </div>
          )}

          {/* ── Help tab ──────────────────────────────────── */}
          {tab === "help" && <StorageHelpTab />}
        </>
      )}

      {/* ── Modals ────────────────────────────────────────── */}
      {showTypeSelector && (
        <ProviderTypeSelector
          onSelect={handleTypeSelected}
          onClose={() => setShowTypeSelector(false)}
        />
      )}

      {showModal && selectedType && (
        <StorageProviderModal
          providerType={selectedType}
          editProvider={editProvider}
          onClose={handleModalClose}
          onSaved={handleModalSaved}
        />
      )}

    </div>
  );
}

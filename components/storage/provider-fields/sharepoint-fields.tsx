"use client";

import Link from "next/link";
import { Info, ExternalLink } from "lucide-react";
import type { StorageProvider } from "../types";

interface SharePointFieldsProps {
  editProvider: StorageProvider | null;
}

export function SharePointFields({ editProvider }: SharePointFieldsProps) {
  const cfg = editProvider?.configuration_json as Record<string, unknown> | null | undefined;
  const siteUrl = cfg?.site_url_preview ? String(cfg.site_url_preview) : null;

  return (
    <div className="bg-[#0078d4]/5 border border-[#0078d4]/20 rounded-xl px-4 py-4 space-y-3">
      <div className="flex items-center gap-2 text-[#0078d4]">
        <Info className="h-4 w-4 shrink-0" />
        <p className="text-xs font-semibold">SharePoint Credentials</p>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        SharePoint credentials — Tenant ID, Client ID, Client Secret, Site URL, and Document
        Library — are managed in <strong>SharePoint Settings</strong> and stored encrypted at
        rest. Changes made there are automatically used by this provider.
      </p>

      {siteUrl && (
        <div className="rounded-lg bg-white border border-[#0078d4]/20 px-3 py-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-0.5">Connected Site</p>
          <p className="text-xs text-slate-600 font-mono truncate">{siteUrl}</p>
        </div>
      )}

      <Link
        href="/admin/sharepoint"
        className="inline-flex items-center gap-1.5 text-xs text-[#0078d4] hover:underline font-medium"
      >
        Open SharePoint Settings <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}

"use client";

import { Construction } from "lucide-react";

export function AzureBlobFields() {
  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm " +
    "focus:outline-none focus:ring-2 focus:ring-[#0089d6] bg-slate-50 " +
    "text-slate-400 cursor-not-allowed";

  return (
    <div className="bg-[#0089d6]/5 border border-[#0089d6]/20 rounded-xl px-4 py-4 space-y-3">
      <div className="flex items-center gap-2 text-[#0089d6]">
        <Construction className="h-4 w-4 shrink-0" />
        <p className="text-xs font-semibold">Azure Blob Storage — Coming Soon</p>
      </div>
      <p className="text-xs text-slate-500">
        Full Azure Blob Storage configuration and upload support will be available in an
        upcoming release. You can register this provider now to reserve a slot.
      </p>

      <div className="space-y-2 opacity-50 pointer-events-none select-none">
        {[
          "Storage Account Name",
          "Container Name",
          "Access Key",
          "Root Path (optional)",
        ].map((label) => (
          <div key={label}>
            <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
            <input disabled placeholder={label} className={input} />
          </div>
        ))}
      </div>
    </div>
  );
}

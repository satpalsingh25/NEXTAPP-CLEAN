"use client";

import { X } from "lucide-react";
import { PROVIDER_META, IMPLEMENTED } from "./provider-meta";
import type { ProviderType } from "./types";

interface ProviderTypeSelectorProps {
  onSelect:  (type: ProviderType) => void;
  onClose:   () => void;
}

export function ProviderTypeSelector({ onSelect, onClose }: ProviderTypeSelectorProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Select Storage Provider</h2>
            <p className="text-xs text-slate-500 mt-0.5">Choose the type of storage backend to add.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Provider grid */}
        <div className="p-6 grid grid-cols-2 gap-3">
          {(Object.entries(PROVIDER_META) as [ProviderType, typeof PROVIDER_META[ProviderType]][]).map(
            ([type, meta]) => {
              const available = IMPLEMENTED.has(type);
              return (
                <button
                  key={type}
                  onClick={() => onSelect(type)}
                  className={`relative flex flex-col items-start gap-2 p-4 rounded-2xl border-2 text-left transition-all group ${
                    available
                      ? "border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer"
                      : "border-slate-100 bg-slate-50 cursor-default opacity-70"
                  }`}
                >
                  {/* Badge */}
                  {!available && (
                    <span className="absolute top-2.5 right-2.5 text-[9px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                      Soon
                    </span>
                  )}

                  {/* Icon */}
                  <div className={`p-2 rounded-xl ${meta.bg} ${meta.color}`}>
                    {meta.icon}
                  </div>

                  {/* Text */}
                  <div>
                    <p className={`text-sm font-semibold ${meta.color}`}>{meta.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{meta.description}</p>
                  </div>
                </button>
              );
            },
          )}
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

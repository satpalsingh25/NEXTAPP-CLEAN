"use client";

import { useEffect, useState } from "react";
import { X, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */
type AccessType = "USER" | "GROUP" | "DEPARTMENT" | "FUNCTION" | "COMPANY";

interface Entity {
  id:   string;
  name: string;
}

interface Permissions {
  can_read:   boolean;
  can_upload: boolean;
  can_write:  boolean;
  can_delete: boolean;
}

interface Props {
  folder_id: string;
  onClose:   () => void;
  onSaved?:  () => void;
}

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */
const ACCESS_TYPES: { value: AccessType; label: string }[] = [
  { value: "USER",       label: "User"       },
  { value: "GROUP",      label: "Group"      },
  { value: "DEPARTMENT", label: "Department" },
  { value: "FUNCTION",   label: "Function"   },
  { value: "COMPANY",    label: "Company"    },
];

const API_MAP: Record<AccessType, string> = {
  USER:       "/api/admin/users",
  GROUP:      "/api/admin/groups",
  DEPARTMENT: "/api/admin/departments",
  FUNCTION:   "/api/admin/functions",
  COMPANY:    "/api/admin/companies",
};

const DEFAULT_PERMS: Permissions = {
  can_read:   false,
  can_upload: false,
  can_write:  false,
  can_delete: false,
};

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */
export default function AssignAccessModal({ folder_id, onClose, onSaved }: Props) {
  const [accessType,   setAccessType]   = useState<AccessType>("USER");
  const [entities,     setEntities]     = useState<Entity[]>([]);
  const [entityId,     setEntityId]     = useState("");
  const [loadingList,  setLoadingList]  = useState(false);
  const [permissions,  setPermissions]  = useState<Permissions>({ ...DEFAULT_PERMS });
  const [saving,       setSaving]       = useState(false);
  const [successMsg,   setSuccessMsg]   = useState("");
  const [errorMsg,     setErrorMsg]     = useState("");

  /* Fetch entity list whenever access type changes */
  useEffect(() => {
    setEntityId(""); setEntities([]); setSuccessMsg(""); setErrorMsg("");
    setLoadingList(true);
    fetch(API_MAP[accessType], { credentials: "include" })
      .then((r) => r.json())
      .then((data: Record<string, string>[]) => {
        // Normalise: Users use name||email, everything else uses name
        const list: Entity[] = (Array.isArray(data) ? data : []).map((item) => ({
          id:   item.id,
          name: accessType === "USER"
            ? (item.name || item.email)
            : item.name,
        }));
        setEntities(list);
      })
      .catch(() => setErrorMsg("Failed to load entities."))
      .finally(() => setLoadingList(false));
  }, [accessType]);

  function togglePerm(key: keyof Permissions) {
    setPermissions((p) => ({ ...p, [key]: !p[key] }));
    setSuccessMsg(""); setErrorMsg("");
  }

  async function handleSave() {
    if (!entityId) { setErrorMsg("Please select an entity."); return; }

    setSaving(true); setSuccessMsg(""); setErrorMsg("");
    try {
      const res  = await fetch("/api/dms/folder-permissions", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder_id,
          access_type:  accessType,
          access_id:    entityId,
          permissions,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setErrorMsg(json.error ?? "Failed to save."); return; }
      setSuccessMsg("Access saved successfully.");
      onSaved?.();
    } catch { setErrorMsg("Network error."); }
    finally { setSaving(false); }
  }

  /* Close on backdrop click */
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdrop}
      data-testid="modal-backdrop"
    >
      <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Assign Access</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            data-testid="btn-close-modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Select Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Select Type
            </label>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden">
              {ACCESS_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setAccessType(value)}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                    accessType === value
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                  data-testid={`btn-type-${value.toLowerCase()}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Select Entity */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Select {ACCESS_TYPES.find((t) => t.value === accessType)?.label}
            </label>
            <div className="relative">
              <select
                value={entityId}
                onChange={(e) => { setEntityId(e.target.value); setSuccessMsg(""); setErrorMsg(""); }}
                disabled={loadingList}
                className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                data-testid="select-entity"
              >
                <option value="">
                  {loadingList ? "Loading…" : `-- Select ${ACCESS_TYPES.find((t) => t.value === accessType)?.label} --`}
                </option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              {loadingList && (
                <RefreshCw
                  size={13}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin pointer-events-none"
                />
              )}
            </div>
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Permissions
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "can_read",   label: "Read"   },
                  { key: "can_upload", label: "Upload" },
                  { key: "can_write",  label: "Write"  },
                  { key: "can_delete", label: "Delete" },
                ] as { key: keyof Permissions; label: string }[]
              ).map(({ key, label }) => (
                <label
                  key={key}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer select-none transition-colors ${
                    permissions[key]
                      ? "border-blue-200 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  data-testid={`perm-${key}`}
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      permissions[key] ? "border-blue-600 bg-blue-600" : "border-slate-300"
                    }`}
                  >
                    {permissions[key] && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={permissions[key]}
                    onChange={() => togglePerm(key)}
                  />
                  <span className="text-sm font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Status messages */}
          {successMsg && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5" data-testid="msg-success">
              <CheckCircle2 size={14} /> {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5" data-testid="msg-error">
              <AlertCircle size={14} /> {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
            data-testid="btn-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !entityId}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="btn-save"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

      </div>
    </div>
  );
}

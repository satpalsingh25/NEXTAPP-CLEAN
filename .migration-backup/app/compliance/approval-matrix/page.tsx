"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  GitBranch, RefreshCw, Eye, Pencil, Trash2, X, Plus,
  AlertCircle, CheckCircle2, ChevronDown, Loader2, Save, ShieldCheck,
} from "lucide-react";

interface ApprovalLevel {
  id: string;
  level: number;
  approver_id: string;
  status?: string;
}

interface MatrixRecord {
  id: string;
  name?: string | null;
  title?: string | null;
  status: string;
  created_at?: string | null;
  template?: { id: string; title: string; approval_levels: number } | null;
  approval_levels: ApprovalLevel[];
}

interface UserOption {
  id: string;
  name?: string | null;
  email: string;
  role: string;
}

const CREDS = { credentials: "include" } as const;

function badge(full: boolean, configured: number, required: number) {
  if (!required) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">No template</span>;
  if (full)      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{configured}/{required} ✓</span>;
  if (configured > 0) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{configured}/{required}</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Not set</span>;
}

/* ─── View Modal ──────────────────────────────────────────────────── */
function ViewModal({ record, users, onClose }: { record: MatrixRecord; users: UserOption[]; onClose: () => void }) {
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const required = record.template?.approval_levels ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{record.name || record.title || "Untitled"}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{record.template?.title} · {required} level{required !== 1 ? "s" : ""} required</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" data-testid="btn-close-view">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-3 flex-1">
          {record.approval_levels.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <GitBranch size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No approval matrix configured yet.</p>
            </div>
          ) : (
            record.approval_levels
              .slice()
              .sort((a, b) => a.level - b.level)
              .map((lvl) => {
                const u = userMap[lvl.approver_id];
                return (
                  <div key={lvl.id} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50" data-testid={`view-level-${lvl.level}`}>
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {lvl.level}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{u?.name || "Unknown"}</p>
                      <p className="text-xs text-slate-400">{u?.email}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Role: {u?.role}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      lvl.status === "APPROVED" ? "bg-green-100 text-green-700" :
                      lvl.status === "REJECTED" ? "bg-red-100 text-red-700" :
                      "bg-slate-100 text-slate-500"
                    }`}>
                      {lvl.status || "PENDING"}
                    </span>
                  </div>
                );
              })
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Modal ──────────────────────────────────────────────────── */
function EditModal({ record, users, onClose, onSaved }: {
  record: MatrixRecord; users: UserOption[]; onClose: () => void; onSaved: () => void;
}) {
  const required = record.template?.approval_levels ?? 1;
  const levelNums = Array.from({ length: required }, (_, i) => i + 1);

  const initApprovers = () => {
    const m: Record<number, string> = {};
    levelNums.forEach((l) => { m[l] = ""; });
    record.approval_levels.forEach((al) => { if (al.level >= 1 && al.level <= required) m[al.level] = al.approver_id; });
    return m;
  };

  const [approvers, setApprovers] = useState<Record<number, string>>(initApprovers);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const usedFor = (lvl: number) =>
    new Set(levelNums.filter((l) => l !== lvl).map((l) => approvers[l]).filter(Boolean));

  const allFilled = levelNums.every((l) => !!approvers[l]);
  const noDupes   = new Set(levelNums.map((l) => approvers[l]).filter(Boolean)).size === levelNums.length;
  const canSave   = allFilled && noDupes && !saving;

  async function handleSave() {
    setError("");
    if (!allFilled) { setError("All levels must have an approver selected."); return; }
    if (!noDupes)   { setError("Each level must have a different approver."); return; }

    const levels = levelNums.map((l) => ({ level: l, approverId: approvers[l] }));
    setSaving(true);
    try {
      const res  = await fetch(`/api/compliance/${record.id}/approval-matrix`, {
        method: "POST", headers: { "Content-Type": "application/json" }, ...CREDS,
        body: JSON.stringify({ levels }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }
      onSaved();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Edit Approval Matrix</h2>
            <p className="text-xs text-slate-400 mt-0.5">{record.name || record.title || "Untitled"} · {required} level{required !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" data-testid="btn-close-edit">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />{error}
            </div>
          )}

          {levelNums.map((lvl) => {
            const used = usedFor(lvl);
            return (
              <div key={lvl} className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-1 pt-1">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {lvl}
                  </div>
                  {lvl < required && <div className="w-0.5 h-5 bg-slate-200" />}
                </div>
                <div className="flex-1 pb-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Level {lvl} Approver<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={approvers[lvl] ?? ""}
                      onChange={(e) => setApprovers((p) => ({ ...p, [lvl]: e.target.value }))}
                      data-testid={`select-approver-level-${lvl}`}
                      className="w-full appearance-none px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-9"
                    >
                      <option value="">— Select approver —</option>
                      {users.map((u) => {
                        const isDupe = used.has(u.id);
                        return (
                          <option key={u.id} value={u.id} disabled={isDupe}>
                            {u.name ? `${u.name} (${u.email})` : u.email} — {u.role}
                            {isDupe ? " (already assigned)" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            data-testid="btn-save-matrix"
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><Save className="w-4 h-4" />Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Delete Confirm ──────────────────────────────────────────────── */
function DeleteConfirm({ record, onClose, onDeleted }: { record: MatrixRecord; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/compliance/${record.id}/approval-matrix`, { method: "DELETE", ...CREDS });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Delete failed."); return; }
      onDeleted();
    } catch {
      setError("Network error.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-100 rounded-full">
            <Trash2 size={18} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Delete Approval Matrix</h2>
            <p className="text-xs text-slate-400 mt-0.5">This will remove all configured levels.</p>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Are you sure you want to delete the approval matrix for{" "}
          <span className="font-semibold">{record.name || record.title || "this record"}</span>?
          This action cannot be undone.
        </p>
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
            <AlertCircle size={13} />{error}
          </div>
        )}
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" data-testid="btn-cancel-delete">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            data-testid="btn-confirm-delete"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? <><Loader2 className="w-4 h-4 animate-spin" />Deleting…</> : <><Trash2 className="w-4 h-4" />Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────── */
export default function ComplianceApprovalMatrixPage() {
  const [records, setRecords]   = useState<MatrixRecord[]>([]);
  const [users, setUsers]       = useState<UserOption[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const [viewRec, setViewRec]   = useState<MatrixRecord | null>(null);
  const [editRec, setEditRec]   = useState<MatrixRecord | null>(null);
  const [deleteRec, setDeleteRec] = useState<MatrixRecord | null>(null);
  const [toast, setToast]       = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetch("/api/compliance/approval-matrix", CREDS).then((r) => r.ok ? r.json() : Promise.reject(r)),
      fetch("/api/admin/users", CREDS).then((r) => r.ok ? r.json() : []),
    ])
      .then(([list, userList]) => {
        setRecords(Array.isArray(list) ? list : []);
        setUsers(Array.isArray(userList) ? userList : []);
      })
      .catch(() => setError("Failed to load approval matrix data."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const configuredCount = records.filter((r) => {
    const req = r.template?.approval_levels ?? 0;
    return req > 0 && r.approval_levels.length === req;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compliance Approval Matrix</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? "Loading…" : `${configuredCount} of ${records.length} records fully configured`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/compliance/approval-matrix/create"
            data-testid="btn-new-matrix"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> New Approval Matrix
          </Link>
          <button
            onClick={load}
            disabled={loading}
            data-testid="btn-refresh"
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
          <CheckCircle2 size={15} />{toast}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          <AlertCircle size={15} />{error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
        </div>
      ) : records.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
          <div className="p-4 bg-slate-50 rounded-full mb-4">
            <ShieldCheck size={32} className="text-slate-400" />
          </div>
          <p className="text-slate-700 font-medium">No compliance records found</p>
          <p className="text-slate-400 text-sm mt-1">Create compliance records first, then configure their approval matrix here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Compliance Name</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Template</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Levels</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Approvers</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => {
                  const required   = r.template?.approval_levels ?? 0;
                  const configured = r.approval_levels.length;
                  const full       = required > 0 && configured === required;
                  const approverNames = r.approval_levels
                    .slice()
                    .sort((a, b) => a.level - b.level)
                    .map((al) => userMap[al.approver_id]?.name || userMap[al.approver_id]?.email || "Unknown")
                    .join(", ");

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors" data-testid={`row-matrix-${r.id}`}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">{r.name || r.title || "Untitled"}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {r.template?.title ?? <span className="text-slate-300 italic">None</span>}
                      </td>
                      <td className="px-5 py-4 text-slate-700 font-medium">{required || "—"}</td>
                      <td className="px-5 py-4 text-slate-500 max-w-xs">
                        {approverNames || <span className="text-slate-300 italic">Not configured</span>}
                      </td>
                      <td className="px-5 py-4">
                        {badge(full, configured, required)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewRec(r)}
                            data-testid={`btn-view-${r.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <Eye size={13} />View
                          </button>
                          <button
                            onClick={() => setEditRec(r)}
                            data-testid={`btn-edit-${r.id}`}
                            disabled={!required}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Pencil size={13} />Edit
                          </button>
                          <button
                            onClick={() => setDeleteRec(r)}
                            data-testid={`btn-delete-${r.id}`}
                            disabled={configured === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={13} />Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {viewRec   && <ViewModal    record={viewRec}   users={users} onClose={() => setViewRec(null)} />}
      {editRec   && (
        <EditModal
          record={editRec}
          users={users}
          onClose={() => setEditRec(null)}
          onSaved={() => { setEditRec(null); showToast("Approval matrix saved successfully."); load(); }}
        />
      )}
      {deleteRec && (
        <DeleteConfirm
          record={deleteRec}
          onClose={() => setDeleteRec(null)}
          onDeleted={() => { setDeleteRec(null); showToast("Approval matrix deleted."); load(); }}
        />
      )}
    </div>
  );
}

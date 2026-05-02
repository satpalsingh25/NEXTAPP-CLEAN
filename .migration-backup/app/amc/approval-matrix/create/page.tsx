"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Wrench, ChevronDown, AlertCircle, Loader2, Save,
} from "lucide-react";

interface RecordOption {
  id: string;
  name: string;
  amcTemplate?: { id: string; name: string; approval_levels: number } | null;
  approval_levels: { id: string; level: number; approver_id: string }[];
}

interface UserOption {
  id: string;
  name?: string | null;
  email: string;
  role: string;
}

const CREDS = { credentials: "include" } as const;

export default function CreateAMCApprovalMatrixPage() {
  const router = useRouter();

  const [records, setRecords]   = useState<RecordOption[]>([]);
  const [users, setUsers]       = useState<UserOption[]>([]);
  const [loading, setLoading]   = useState(true);

  const [selectedId, setSelectedId]   = useState("");
  const [numLevels, setNumLevels]     = useState(1);
  const [approvers, setApprovers]     = useState<Record<number, string>>({});

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/amc/approval-matrix", CREDS).then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/users", CREDS).then((r) => r.ok ? r.json() : []),
    ])
      .then(([list, userList]) => {
        setRecords(Array.isArray(list) ? list : []);
        setUsers(Array.isArray(userList) ? userList : []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // When record changes, auto-set level count from template
  useEffect(() => {
    if (!selectedId) { setNumLevels(1); setApprovers({}); return; }
    const rec = records.find((r) => r.id === selectedId);
    const required = rec?.amcTemplate?.approval_levels ?? 1;
    const capped = Math.min(Math.max(required, 1), 3) as 1 | 2 | 3;
    setNumLevels(capped);
    // Pre-fill existing approvers if already configured
    const init: Record<number, string> = {};
    for (let i = 1; i <= capped; i++) init[i] = "";
    rec?.approval_levels?.forEach((al) => {
      if (al.level >= 1 && al.level <= capped) init[al.level] = al.approver_id;
    });
    setApprovers(init);
  }, [selectedId, records]);

  // Re-initialize approvers when level count changes
  function handleLevelChange(n: number) {
    setNumLevels(n);
    setApprovers((prev) => {
      const next: Record<number, string> = {};
      for (let i = 1; i <= n; i++) next[i] = prev[i] ?? "";
      return next;
    });
  }

  const levelNums  = Array.from({ length: numLevels }, (_, i) => i + 1);
  const allFilled  = !!selectedId && levelNums.every((l) => !!approvers[l]);
  const filledIds  = levelNums.map((l) => approvers[l]).filter(Boolean);
  const noDupes    = new Set(filledIds).size === filledIds.length;
  const canSave    = allFilled && noDupes && !saving;

  const usedFor = (lvl: number) =>
    new Set(levelNums.filter((l) => l !== lvl).map((l) => approvers[l]).filter(Boolean));

  const selectedRec = records.find((r) => r.id === selectedId);

  async function handleSave() {
    setError("");
    if (!selectedId)  { setError("Please select an AMC record."); return; }
    if (!allFilled)   { setError("All level approvers must be selected."); return; }
    if (!noDupes)     { setError("Each level must have a different approver."); return; }

    const levels = levelNums.map((l) => ({ level: l, approverId: approvers[l] }));
    setSaving(true);
    try {
      const res  = await fetch(`/api/amc/${selectedId}/approval-matrix`, {
        method: "POST", headers: { "Content-Type": "application/json" }, ...CREDS,
        body: JSON.stringify({ levels }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }
      router.push("/amc/approval-matrix");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/amc/approval-matrix"
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          data-testid="btn-back"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Approval Matrix</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configure approvers for an AMC record</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />{error}
          </div>
        )}

        {/* Select AMC */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            AMC Record<span className="text-red-500 ml-0.5">*</span>
          </label>
          {loading ? (
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <div className="relative">
              <select
                value={selectedId}
                onChange={(e) => { setSelectedId(e.target.value); setError(""); }}
                data-testid="select-amc"
                className="w-full appearance-none px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-9"
              >
                <option value="">— Select an AMC record —</option>
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name || "Untitled"}{r.amcTemplate ? ` — ${r.amcTemplate.name}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          )}
          {selectedRec?.amcTemplate && (
            <p className="text-xs text-slate-400 mt-1.5">
              Template requires <strong>{selectedRec.amcTemplate.approval_levels}</strong> approval level{selectedRec.amcTemplate.approval_levels !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Approval Levels count */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Approval Levels<span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="relative w-40">
            <select
              value={numLevels}
              onChange={(e) => { handleLevelChange(Number(e.target.value)); setError(""); }}
              data-testid="select-levels"
              className="w-full appearance-none px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-9"
            >
              <option value={1}>1 Level</option>
              <option value={2}>2 Levels</option>
              <option value={3}>3 Levels</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Dynamic approver dropdowns */}
        {selectedId && (
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Assign Approvers</p>
            {loading ? (
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            ) : users.length === 0 ? (
              <p className="text-sm text-slate-400">No users available to assign as approvers.</p>
            ) : (
              levelNums.map((lvl) => {
                const used = usedFor(lvl);
                return (
                  <div key={lvl} className="flex items-start gap-4 pb-4">
                    <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                        {lvl}
                      </div>
                      {lvl < numLevels && <div className="w-0.5 h-5 bg-slate-200" />}
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Level {lvl} Approver<span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={approvers[lvl] ?? ""}
                          onChange={(e) => {
                            setApprovers((p) => ({ ...p, [lvl]: e.target.value }));
                            setError("");
                          }}
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
              })
            )}
          </div>
        )}

        {!selectedId && !loading && (
          <div className="flex flex-col items-center py-8 text-slate-400">
            <Wrench size={28} className="mb-2 opacity-40" />
            <p className="text-sm">Select an AMC record above to assign approvers.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <Link
            href="/amc/approval-matrix"
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            data-testid="btn-cancel"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={!canSave}
            data-testid="btn-save"
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><Save className="w-4 h-4" />Save Matrix</>}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, GitBranch, Save, AlertCircle, CheckCircle2, ChevronDown, Loader2 } from "lucide-react";

interface UserOption {
  id: string;
  name?: string | null;
  email: string;
  role: string;
}

interface ExistingLevel {
  id: string;
  level: number;
  approver_id: string;
  status: string;
  approver?: { id: string; name?: string | null; email: string; role: string } | null;
}

interface MatrixResponse {
  required_levels: number;
  levels: ExistingLevel[];
}

interface ComplianceInfo {
  id: string;
  title?: string | null;
  template?: { id: string; title: string; approval_levels: number } | null;
}

const CREDS = { credentials: "include" } as const;

function UserSelect({
  level,
  total,
  value,
  onChange,
  users,
}: {
  level: number;
  total: number;
  value: string;
  onChange: (v: string) => void;
  users: UserOption[];
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-1">
        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
          {level}
        </div>
        {level < total && <div className="w-0.5 h-6 bg-slate-200" />}
      </div>

      <div className="flex-1 pb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Level {level} Approver
          <span className="text-red-500 ml-0.5">*</span>
        </label>
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            data-testid={`select-approver-level-${level}`}
            className="w-full appearance-none px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-9"
          >
            <option value="">— Select approver —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ? `${u.name} (${u.email})` : u.email} — {u.role}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

export default function ComplianceApprovalMatrixPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [compliance, setCompliance] = useState<ComplianceInfo | null>(null);
  const [users, setUsers]           = useState<UserOption[]>([]);
  const [requiredLevels, setRequiredLevels] = useState(1);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState("");

  // keyed by level number
  const [approvers, setApprovers] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/compliance/${id}`, CREDS).then((r) => r.ok ? r.json() : null),
      fetch(`/api/compliance/${id}/approval-matrix`, CREDS).then((r) => r.ok ? r.json() : { required_levels: 1, levels: [] }),
      fetch("/api/admin/users", CREDS).then((r) => r.ok ? r.json() : []),
    ])
      .then(([comp, matrixResp, userList]: [ComplianceInfo | null, MatrixResponse | ExistingLevel[], UserOption[]]) => {
        setCompliance(comp);
        setUsers(Array.isArray(userList) ? userList : []);

        // Support both old array shape and new { required_levels, levels } shape
        let required = 1;
        let existingLevels: ExistingLevel[] = [];

        if (Array.isArray(matrixResp)) {
          existingLevels = matrixResp;
          required = comp?.template?.approval_levels ?? 1;
        } else {
          required = (matrixResp as MatrixResponse).required_levels ?? 1;
          existingLevels = (matrixResp as MatrixResponse).levels ?? [];
        }

        setRequiredLevels(required);

        // Build initial approvers map — only for levels within required range
        const init: Record<number, string> = {};
        for (let lvl = 1; lvl <= required; lvl++) init[lvl] = "";
        existingLevels.forEach((m) => {
          if (m.level >= 1 && m.level <= required) init[m.level] = m.approver_id;
        });
        setApprovers(init);
      })
      .catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    setError("");
    setSaved(false);

    // All levels must be filled
    const levelNums = Array.from({ length: requiredLevels }, (_, i) => i + 1);
    const missing = levelNums.filter((lvl) => !approvers[lvl]);
    if (missing.length > 0) {
      setError(`Please select an approver for level${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
      return;
    }

    // No duplicate approvers
    const ids = levelNums.map((lvl) => approvers[lvl]);
    if (new Set(ids).size !== ids.length) {
      setError("Each level must have a different approver.");
      return;
    }

    const levels = levelNums.map((lvl) => ({ level: lvl, approverId: approvers[lvl] }));

    setSaving(true);
    try {
      const res = await fetch(`/api/compliance/${id}/approval-matrix`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        ...CREDS,
        body: JSON.stringify({ levels }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save approval matrix.");
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const title = compliance?.title || compliance?.template?.title || "Compliance Record";
  const levelNums = Array.from({ length: requiredLevels }, (_, i) => i + 1);

  const selectedIds = levelNums.map((lvl) => approvers[lvl] ?? "");
  const allFilled   = selectedIds.every((v) => v !== "");
  const noDupes     = new Set(selectedIds.filter(Boolean)).size === selectedIds.filter(Boolean).length;
  const canSave     = allFilled && noDupes;

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <button
        onClick={() => router.push(`/compliance/${id}`)}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
        data-testid="btn-back"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to record
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-50 rounded-xl">
          <GitBranch className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Approval Matrix</h1>
          <p className="text-sm text-slate-500 mt-0.5 truncate max-w-xs">{title}</p>
          {!loading && (
            <p className="text-xs text-blue-600 font-medium mt-0.5">
              {requiredLevels} level{requiredLevels !== 1 ? "s" : ""} required by template
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {error && (
            <div className="mb-5 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg" data-testid="error-matrix">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {saved && (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg" data-testid="success-matrix">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Approval matrix saved successfully.</span>
            </div>
          )}

          {users.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No users available to assign as approvers.</p>
          ) : (
            <>
              <div className="mb-1">
                {levelNums.map((lvl) => (
                  <UserSelect
                    key={lvl}
                    level={lvl}
                    total={requiredLevels}
                    value={approvers[lvl] ?? ""}
                    onChange={(v) => setApprovers((prev) => ({ ...prev, [lvl]: v }))}
                    users={users}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={handleSave}
                  disabled={saving || !canSave}
                  data-testid="btn-save-matrix"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  ) : (
                    <><Save className="w-4 h-4" /> Save Matrix</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/compliance/${id}`)}
                  data-testid="btn-cancel"
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck, RefreshCw, AlertCircle,
  FileText, CheckCircle2, XCircle,
  X, FilePlus2, Send, Clock, Layers, Activity,
} from "lucide-react";
import SubmitModal from "@/components/SubmitModal";
/* ─── Types ─────────────────────────────────────────────────────────────── */

interface TaskRow {
  id: string;
  name: string;
  template_name: string | null;
  due_date: string;
  status: string;
  current_level: number;
  total_levels: number;
  is_overdue: boolean;
  assigned_user_id: string | null;
  can_act: boolean;
  approval_level_id: string | null;
}

type LogEntry = {
  id: string;
  action: string;
  level_number: number;
  timestamp: string;
  remarks: string | null;
  actor_name: string | null;
  actor_email: string | null;
};

type DetailData = {
  name: string;
  status: string;
  created_at: string;
  current_level: number;
  due_date: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  template?: { title?: string; name?: string; approval_levels?: number } | null;
  approval_logs: LogEntry[];
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const fmtFull = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-yellow-100 text-yellow-700",
  APPROVED:  "bg-green-100 text-green-700",
  REJECTED:  "bg-red-100 text-red-700",
  OVERDUE:   "bg-orange-100 text-orange-700",
};

function StatusBadge({ status, isOverdue }: { status: string; isOverdue: boolean }) {
  const label = isOverdue && status !== "APPROVED" ? "OVERDUE" : status;
  const cls   = STATUS_COLORS[label] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function TimelineStep({
  icon, label, user, date, remarks, done,
}: {
  icon: React.ReactNode;
  label: string;
  user: string | null;
  date: string | null;
  remarks?: string | null;
  done: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0 ${
          done ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-400"
        }`}>
          {icon}
        </div>
        <div className="w-px flex-1 bg-slate-200 mt-1" />
      </div>
      <div className="pb-5 pt-0.5 min-w-0">
        <p className={`text-sm font-semibold ${done ? "text-slate-900" : "text-slate-400"}`}>{label}</p>
        {user && <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Send size={10} />{user}</p>}
        {date && <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><Clock size={10} />{fmtFull(date)}</p>}
        {remarks && (
          <p className="text-xs text-slate-500 italic mt-1 bg-slate-50 rounded px-2 py-1 border border-slate-100">
            "{remarks}"
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Details Modal ──────────────────────────────────────────────────────── */

function DetailsModal({ row, onClose }: { row: TaskRow; onClose: () => void }) {
  const [data, setData]         = useState<DetailData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchErr, setFetchErr] = useState("");

  useEffect(() => {
    fetch(`/api/compliance/${row.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.error) setFetchErr(d.error); else setData(d); setLoadingData(false); })
      .catch(() => { setFetchErr("Failed to load."); setLoadingData(false); });
  }, [row.id]);

  const totalLevels  = data?.template?.approval_levels ?? row.total_levels;
  const currentLevel = data?.current_level ?? row.current_level;
  const progressPct  = totalLevels > 0 ? Math.round((currentLevel / totalLevels) * 100) : 0;
  const submittedLog = data?.approval_logs.find((l) => l.action === "SUBMITTED") ?? null;
  const approvalLogs = data?.approval_logs.filter((l) => l.action === "APPROVED" || l.action === "REJECTED") ?? [];
  const maxLevel     = Math.max(0, ...approvalLogs.map((l) => l.level_number));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="min-w-0 pr-4">
            {loadingData ? (
              <div className="space-y-2">
                <div className="h-5 w-52 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
              </div>
            ) : data ? (
              <>
                <h2 className="text-base font-bold text-slate-900 truncate">{data.name}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                  <span className={`font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${STATUS_COLORS[data.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {data.status}
                  </span>
                  {data.due_date && <span className="flex items-center gap-1"><Clock size={11} />Due {fmtDate(data.due_date)}</span>}
                </div>
              </>
            ) : <p className="text-sm text-red-600">{fetchErr}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0" data-testid="btn-close-details-modal">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {loadingData ? (
            <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}</div>
          ) : data ? (
            <>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approval Progress</p>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                    Level {currentLevel} of {totalLevels}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-2 bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Activity size={12} /> Approval History
                </p>
                <TimelineStep
                  icon={<FilePlus2 size={13} />}
                  label="Draft Created"
                  user={null}
                  date={data.created_at}
                  done
                />
                <TimelineStep
                  icon={<Send size={13} />}
                  label="Submitted for Approval"
                  user={data.submitter_name ?? data.submitter_email ?? submittedLog?.actor_email ?? null}
                  date={submittedLog?.timestamp ?? null}
                  done={!!submittedLog}
                />
                {Array.from({ length: Math.max(maxLevel, totalLevels) }, (_, i) => i + 1).map((lvl) => {
                  const log = approvalLogs.find((l) => l.level_number === lvl) ?? null;
                  const isApproved = log?.action === "APPROVED";
                  const isRejected = log?.action === "REJECTED";
                  return (
                    <TimelineStep
                      key={lvl}
                      icon={isApproved ? <CheckCircle2 size={13} /> : isRejected ? <XCircle size={13} /> : <Clock size={13} />}
                      label={`Level ${lvl} Approval`}
                      user={log?.actor_name ?? log?.actor_email ?? null}
                      date={log?.timestamp ?? null}
                      remarks={log?.remarks ?? null}
                      done={!!log}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-red-600 text-sm py-4"><AlertCircle size={15} />{fetchErr}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function ComplianceMyTasksPage() {
  const [rows, setRows]             = useState<TaskRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [detailsRow, setDetailsRow] = useState<TaskRow | null>(null);

  const [submitRow, setSubmitRow]   = useState<string | null>(null);

  // Approval modal state
  const [pendingRow,       setPendingRow]       = useState<TaskRow | null>(null);
  const [modalRemarks,     setModalRemarks]     = useState("");
  const [modalErr,         setModalErr]         = useState("");
  const [modalSubmitting,  setModalSubmitting]  = useState(false);

  const fetchTasks = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/compliance/my-tasks", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setRows(d);
        else setError(d.error ?? "Failed to load tasks.");
        setLoading(false);
      })
      .catch(() => { setError("Network error."); setLoading(false); });
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  function openApprovalModal(r: TaskRow) {
    setPendingRow(r);
    setModalRemarks("");
    setModalErr("");
  }

  async function submitApproval(action: "approve" | "reject") {
    if (!pendingRow?.approval_level_id) return;
    if (action === "reject" && !modalRemarks.trim()) {
      setModalErr("Remarks are required when rejecting.");
      return;
    }
    setModalSubmitting(true);
    setModalErr("");
    try {
      const res = await fetch("/api/approvals/compliance/action", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: pendingRow.approval_level_id,
          action,
          remarks: modalRemarks.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setModalErr(json.error ?? "Action failed. Please try again.");
      } else {
        setPendingRow(null);
        fetchTasks();
      }
    } catch {
      setModalErr("Network error. Please try again.");
    } finally {
      setModalSubmitting(false);
    }
  }

  const hasApproverRows = rows.some((r) => r.can_act);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">My Compliance Tasks</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {hasApproverRows ? "Records awaiting your approval" : "Records assigned to you pending submission"}
              </p>
            </div>
          </div>
          <button
            onClick={fetchTasks}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            data-testid="btn-refresh"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <ShieldCheck size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">No pending tasks</p>
              <p className="text-xs mt-1">Tasks requiring your action will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-slate-700">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Level</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors" data-testid={`row-task-${r.id}`}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800 text-sm">{r.name}</p>
                        {r.template_name && r.template_name !== r.name && (
                          <p className="text-xs text-slate-400 mt-0.5">{r.template_name}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {r.due_date ? fmtDate(r.due_date) : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={r.status} isOverdue={r.is_overdue} />
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                          <Layers size={11} /> {r.current_level}/{r.total_levels}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {r.can_act ? (
                            <>
                              <button
                                onClick={() => setDetailsRow(r)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-blue-200 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors"
                                data-testid={`btn-details-${r.id}`}
                              >
                                <FileText size={12} /> Details
                              </button>
                              <button
                                onClick={() => openApprovalModal(r)}
                                disabled={r.status !== "SUBMITTED"}
                                title={r.status !== "SUBMITTED" ? "Only SUBMITTED records can be reviewed" : undefined}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                data-testid={`btn-approve-${r.id}`}
                              >
                                <CheckCircle2 size={12} /> Approve
                              </button>
                              <button
                                onClick={() => openApprovalModal(r)}
                                disabled={r.status !== "SUBMITTED"}
                                title={r.status !== "SUBMITTED" ? "Only SUBMITTED records can be reviewed" : undefined}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                data-testid={`btn-reject-${r.id}`}
                              >
                                <XCircle size={12} /> Reject
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setSubmitRow(r.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                                data-testid={`btn-submit-${r.id}`}
                              >
                                <Send size={12} /> Submit
                              </button>
                              <button
                                onClick={() => setDetailsRow(r)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-blue-200 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors"
                                data-testid={`btn-details-${r.id}`}
                              >
                                <FileText size={12} /> Details
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer count */}
        {!loading && rows.length > 0 && (
          <p className="text-xs text-slate-400 mt-3 px-1">
            {rows.length} task{rows.length !== 1 ? "s" : ""} pending
          </p>
        )}
      </div>

      {/* Details Modal */}
      {detailsRow && (
        <DetailsModal row={detailsRow} onClose={() => setDetailsRow(null)} />
      )}

      {/* Submit Modal */}
      {submitRow && (
        <SubmitModal
          endpoint={`/api/compliance/${submitRow}/submit`}
          title="Submit Compliance"
          onClose={() => setSubmitRow(null)}
          onSuccess={fetchTasks}
        />
      )}

      {/* Approval Action Modal */}
      {pendingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !modalSubmitting && setPendingRow(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Review Record</h2>
                  <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[240px]">{pendingRow.name}</p>
                </div>
              </div>
              <button
                onClick={() => !modalSubmitting && setPendingRow(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                data-testid="btn-modal-close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Remarks
                  <span className="text-slate-400 font-normal ml-1">(required for rejection)</span>
                </label>
                <textarea
                  rows={4}
                  value={modalRemarks}
                  onChange={(e) => { setModalRemarks(e.target.value); setModalErr(""); }}
                  disabled={modalSubmitting}
                  placeholder="Enter your remarks…"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50"
                  data-testid="input-modal-remarks"
                />
                {modalErr && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                    <AlertCircle size={11} /> {modalErr}
                  </p>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => !modalSubmitting && setPendingRow(null)}
                disabled={modalSubmitting}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
                data-testid="btn-modal-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => submitApproval("reject")}
                disabled={modalSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="btn-modal-reject"
              >
                {modalSubmitting ? <RefreshCw size={13} className="animate-spin" /> : <XCircle size={13} />}
                {modalSubmitting ? "Processing…" : "Reject"}
              </button>
              <button
                onClick={() => submitApproval("approve")}
                disabled={modalSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="btn-modal-approve"
              >
                {modalSubmitting ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                {modalSubmitting ? "Processing…" : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

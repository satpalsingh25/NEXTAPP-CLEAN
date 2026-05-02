"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck, Wrench, RefreshCw, CheckCircle2, XCircle,
  Activity, FileText, AlertCircle, Inbox,
  X, FilePlus2, Send, Clock,
} from "lucide-react";

interface PendingRecord {
  id: string;
  approval_level_id: string;
  name: string;
  submitted_by: string;
  due_date: string | null;
  level: number;
}

type Module = "compliance" | "amc";

interface ActionState {
  approval_level_id: string;
  module: Module;
  type: "approve" | "reject";
  remarks: string;
  loading: boolean;
}

interface StatusModalTarget {
  id: string;
  module: Module;
}

interface DetailsModalTarget {
  record: PendingRecord;
  module: Module;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="p-3 bg-slate-50 rounded-full mb-3">
        <Inbox size={28} className="text-slate-300" />
      </div>
      <p className="text-slate-500 text-sm font-medium">No pending approvals</p>
      <p className="text-slate-400 text-xs mt-1">No {label} records are awaiting your approval.</p>
    </div>
  );
}

export default function PendingApprovalsPage() {
  const router = useRouter();

  const [compliance, setCompliance] = useState<PendingRecord[]>([]);
  const [amc, setAmc] = useState<PendingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<ActionState | null>(null);
  const [actionError, setActionError] = useState("");
  const [statusModal, setStatusModal] = useState<StatusModalTarget | null>(null);
  const [detailsModal, setDetailsModal] = useState<DetailsModalTarget | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cr, ar] = await Promise.all([
        fetch("/api/approvals/compliance/pending", { credentials: "include" }),
        fetch("/api/approvals/amc/pending", { credentials: "include" }),
      ]);
      if (cr.status === 401 || ar.status === 401) { router.push("/auth/login"); return; }
      const [cd, ad] = await Promise.all([cr.json(), ar.json()]);
      setCompliance(Array.isArray(cd) ? cd : []);
      setAmc(Array.isArray(ad) ? ad : []);
    } catch {
      setError("Failed to load pending approvals.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function openAction(approval_level_id: string, module: Module, type: "approve" | "reject") {
    setActionError("");
    setAction({ approval_level_id, module, type, remarks: "", loading: false });
  }

  function closeAction() {
    setAction(null);
    setActionError("");
  }

  async function submitAction() {
    if (!action) return;
    setAction((a) => a ? { ...a, loading: true } : a);
    setActionError("");

    const url = `/api/approvals/${action.module}/action`;
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: action.approval_level_id,
          action: action.type,
          remarks: action.remarks,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Action failed");
        setAction((a) => a ? { ...a, loading: false } : a);
        return;
      }
      closeAction();
      fetchAll();
    } catch {
      setActionError("Network error. Please try again.");
      setAction((a) => a ? { ...a, loading: false } : a);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" data-testid="page-title">
            Pending Approvals
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Records awaiting your approval</p>
        </div>
        <button
          onClick={fetchAll}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          data-testid="btn-refresh"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      <Section
        title="Compliance Approvals"
        icon={<ShieldCheck size={16} className="text-violet-600" />}
        records={compliance}
        module="compliance"
        loading={loading}
        onAction={openAction}
        onStatus={(id) => setStatusModal({ id, module: "compliance" })}
        onDetails={(r) => setDetailsModal({ record: r, module: "compliance" })}
      />

      <Section
        title="AMC Approvals"
        icon={<Wrench size={16} className="text-amber-600" />}
        records={amc}
        module="amc"
        loading={loading}
        onAction={openAction}
        onStatus={(id) => setStatusModal({ id, module: "amc" })}
        onDetails={(r) => setDetailsModal({ record: r, module: "amc" })}
      />

      {statusModal && (
        <CurrentStatusModal
          id={statusModal.id}
          module={statusModal.module}
          onClose={() => setStatusModal(null)}
        />
      )}

      {detailsModal && (
        <DetailsModal
          record={detailsModal.record}
          module={detailsModal.module}
          onClose={() => setDetailsModal(null)}
          onRefresh={fetchAll}
        />
      )}

      {action && (
        <ActionModal
          action={action}
          error={actionError}
          onChange={(remarks) => setAction((a) => a ? { ...a, remarks } : a)}
          onConfirm={submitAction}
          onCancel={closeAction}
        />
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  records,
  module,
  loading,
  onAction,
  onStatus,
  onDetails,
}: {
  title: string;
  icon: React.ReactNode;
  records: PendingRecord[];
  module: Module;
  loading: boolean;
  onAction: (approval_level_id: string, module: Module, type: "approve" | "reject") => void;
  onStatus: (id: string) => void;
  onDetails: (record: PendingRecord) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50">
        {icon}
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <span className="ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-xs font-bold bg-slate-200 text-slate-600">
          {records.length}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-slate-900" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState label={module === "compliance" ? "compliance" : "AMC"} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Submitted By</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Due Date</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Level</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-50 transition-colors"
                  data-testid={`row-pending-${module}-${r.id}`}
                >
                  <td className="px-5 py-4 font-medium text-slate-900">{r.name}</td>
                  <td className="px-5 py-4 text-slate-600">{r.submitted_by}</td>
                  <td className="px-5 py-4 text-slate-600">
                    {r.due_date ? fmtDate(r.due_date) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                      Level {r.level}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onStatus(r.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                        data-testid={`btn-status-${module}-${r.id}`}
                      >
                        <Activity size={12} /> Current Status
                      </button>
                      <button
                        onClick={() => onDetails(r)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-blue-200 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors"
                        data-testid={`btn-details-${module}-${r.id}`}
                      >
                        <FileText size={12} /> Details
                      </button>
                      <button
                        onClick={() => onAction(r.approval_level_id, module, "approve")}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
                        data-testid={`btn-approve-${module}-${r.id}`}
                      >
                        <CheckCircle2 size={12} /> Approve
                      </button>
                      <button
                        onClick={() => onAction(r.approval_level_id, module, "reject")}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
                        data-testid={`btn-reject-${module}-${r.id}`}
                      >
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ActionModal({
  action,
  error,
  onChange,
  onConfirm,
  onCancel,
}: {
  action: ActionState;
  error: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isApprove = action.type === "approve";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isApprove ? "bg-green-50" : "bg-red-50"}`}>
            {isApprove
              ? <CheckCircle2 size={20} className="text-green-600" />
              : <XCircle size={20} className="text-red-600" />}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">
              {isApprove ? "Approve Record" : "Reject Record"}
            </h3>
            <p className="text-xs text-slate-500 capitalize">
              {action.module} — Level {action.type === "approve" ? "approval" : "rejection"}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Remarks {!isApprove && <span className="text-red-500">*</span>}
          </label>
          <textarea
            rows={3}
            value={action.remarks}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isApprove ? "Optional remarks…" : "Reason for rejection (required)"}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition"
            data-testid="input-action-remarks"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={action.loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            data-testid="btn-action-cancel"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={action.loading || (!isApprove && !action.remarks.trim())}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isApprove
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
            data-testid="btn-action-confirm"
          >
            {action.loading
              ? "Processing…"
              : isApprove ? "Confirm Approve" : "Confirm Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Current Status Modal ─────────────────────────────────────────────── */

type LogEntry = {
  id: string;
  action: string;
  level_number: number;
  timestamp: string;
  remarks: string | null;
  actor_name: string | null;
  actor_email: string | null;
};

type StatusDetail = {
  name: string;
  status: string;
  created_at: string;
  current_level: number;
  due_date: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  template?: { title?: string; name?: string; approval_levels?: number } | null;
  amcTemplate?: { name?: string; approval_levels?: number } | null;
  approval_logs: LogEntry[];
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-yellow-100 text-yellow-700",
  APPROVED:  "bg-green-100 text-green-700",
  REJECTED:  "bg-red-100 text-red-700",
};

const fmtFull = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

function TimelineStep({
  icon,
  label,
  user,
  date,
  remarks,
  done,
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
          done
            ? "bg-blue-600 border-blue-600 text-white"
            : "bg-white border-slate-200 text-slate-400"
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

function CurrentStatusModal({
  id,
  module,
  onClose,
}: {
  id: string;
  module: Module;
  onClose: () => void;
}) {
  const [data, setData] = useState<StatusDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    setErr("");
    fetch(`/api/${module}/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setErr(d.error); } else { setData(d); }
        setLoading(false);
      })
      .catch(() => { setErr("Failed to load record."); setLoading(false); });
  }, [id, module]);

  const submittedLog   = data?.approval_logs.find((l) => l.action === "SUBMITTED") ?? null;
  const approvalLogs   = data?.approval_logs.filter((l) => l.action === "APPROVED" || l.action === "REJECTED") ?? [];
  const maxLevel       = data ? Math.max(0, ...approvalLogs.map((l) => l.level_number)) : 0;
  const templateName   = data?.template?.title ?? data?.template?.name ?? data?.amcTemplate?.name ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div className="min-w-0 pr-4">
            {loading ? (
              <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
            ) : data ? (
              <>
                <h2 className="text-base font-bold text-slate-900 truncate" data-testid="modal-status-name">
                  {data.name}
                </h2>
                {templateName && (
                  <p className="text-xs text-slate-400 mt-0.5">{templateName}</p>
                )}
                <span className={`inline-block mt-2 text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${STATUS_COLORS[data.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {data.status}
                </span>
              </>
            ) : (
              <p className="text-sm text-red-600">{err}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
            data-testid="btn-close-status-modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Timeline */}
        <div className="px-6 py-5 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : data ? (
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Activity size={12} /> Approval Timeline
              </p>
              <div>
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
                {Array.from({ length: Math.max(maxLevel, 1) }, (_, i) => i + 1).map((lvl) => {
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
            <div className="flex items-center gap-2 text-red-600 text-sm py-4">
              <AlertCircle size={15} /> {err}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Details + Action Modal ───────────────────────────────────────────── */

function DetailsModal({
  record,
  module,
  onClose,
  onRefresh,
}: {
  record: PendingRecord;
  module: Module;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [data, setData] = useState<StatusDetail | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchErr, setFetchErr] = useState("");

  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionErr, setActionErr] = useState("");

  useEffect(() => {
    setLoadingData(true);
    setFetchErr("");
    fetch(`/api/${module}/${record.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setFetchErr(d.error); } else { setData(d); }
        setLoadingData(false);
      })
      .catch(() => { setFetchErr("Failed to load record."); setLoadingData(false); });
  }, [record.id, module]);

  const totalLevels =
    data?.template?.approval_levels ?? data?.amcTemplate?.approval_levels ?? record.level;
  const currentLevel = data?.current_level ?? record.level;
  const progressPct  = totalLevels > 0 ? Math.round((currentLevel / totalLevels) * 100) : 0;

  const submittedLog  = data?.approval_logs.find((l) => l.action === "SUBMITTED") ?? null;
  const approvalLogs  = data?.approval_logs.filter((l) => l.action === "APPROVED" || l.action === "REJECTED") ?? [];

  async function handleAction(type: "approve" | "reject") {
    if (type === "reject" && !remarks.trim()) {
      setActionErr("Remarks are required when rejecting.");
      return;
    }
    setSubmitting(true);
    setActionErr("");
    try {
      const res = await fetch(`/api/approvals/${module}/action`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: record.approval_level_id,
          action: type,
          remarks,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionErr(json.error ?? "Action failed. Please try again.");
        setSubmitting(false);
        return;
      }
      onClose();
      onRefresh();
    } catch {
      setActionErr("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="min-w-0 pr-4">
            {loadingData ? (
              <div className="space-y-2">
                <div className="h-5 w-52 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
              </div>
            ) : data ? (
              <>
                <h2 className="text-base font-bold text-slate-900 truncate" data-testid="modal-details-name">
                  {data.name}
                </h2>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                  <span className={`font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${STATUS_COLORS[data.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {data.status}
                  </span>
                  {data.due_date && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> Due {fmtDate(data.due_date)}
                    </span>
                  )}
                  {(data.submitter_name ?? data.submitter_email) && (
                    <span className="flex items-center gap-1">
                      <Send size={11} /> {data.submitter_name ?? data.submitter_email}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-red-600">{fetchErr}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
            data-testid="btn-close-details-modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {loadingData ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : data ? (
            <>
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Approval Progress
                  </p>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                    Level {currentLevel} of {totalLevels}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                  {Array.from({ length: totalLevels }, (_, i) => (
                    <span
                      key={i}
                      className={`font-medium ${i + 1 <= currentLevel ? "text-blue-500" : ""} ${i + 1 === currentLevel ? "font-bold text-blue-700" : ""}`}
                    >
                      L{i + 1}
                    </span>
                  ))}
                </div>
              </div>

              {/* Approval history */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Activity size={12} /> Approval History
                </p>
                <div>
                  <TimelineStep
                    icon={<Send size={13} />}
                    label="Submitted for Approval"
                    user={data.submitter_name ?? data.submitter_email ?? submittedLog?.actor_email ?? null}
                    date={submittedLog?.timestamp ?? null}
                    done={!!submittedLog}
                  />
                  {Array.from({ length: Math.max(totalLevels, currentLevel) }, (_, i) => i + 1).map((lvl) => {
                    const log = approvalLogs.find((l) => l.level_number === lvl) ?? null;
                    const isApproved = log?.action === "APPROVED";
                    const isRejected = log?.action === "REJECTED";
                    const isCurrent  = lvl === currentLevel && !log;
                    return (
                      <div
                        key={lvl}
                        className={isCurrent ? "relative" : ""}
                      >
                        {isCurrent && (
                          <span className="absolute -left-1 top-1.5 w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        )}
                        <TimelineStep
                          icon={isApproved ? <CheckCircle2 size={13} /> : isRejected ? <XCircle size={13} /> : <Clock size={13} />}
                          label={
                            isCurrent
                              ? `Level ${lvl} Approval ← Awaiting`
                              : `Level ${lvl} Approval`
                          }
                          user={log?.actor_name ?? log?.actor_email ?? null}
                          date={log?.timestamp ?? null}
                          remarks={log?.remarks ?? null}
                          done={!!log}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-red-600 text-sm py-4">
              <AlertCircle size={15} /> {fetchErr}
            </div>
          )}
        </div>

        {/* ── Action section ── */}
        <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 shrink-0 space-y-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Remarks
              <span className="ml-1 text-slate-400 font-normal text-xs">(required on reject)</span>
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => { setRemarks(e.target.value); setActionErr(""); }}
              placeholder="Add remarks…"
              disabled={submitting}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition disabled:opacity-60"
              data-testid="input-details-remarks"
            />
          </div>

          {actionErr && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              {actionErr}
            </div>
          )}

          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
              data-testid="btn-details-cancel"
            >
              Cancel
            </button>
            <button
              onClick={() => handleAction("reject")}
              disabled={submitting || loadingData}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="btn-details-reject"
            >
              <XCircle size={14} />
              {submitting ? "Processing…" : "Reject"}
            </button>
            <button
              onClick={() => handleAction("approve")}
              disabled={submitting || loadingData}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="btn-details-approve"
            >
              <CheckCircle2 size={14} />
              {submitting ? "Processing…" : "Approve"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

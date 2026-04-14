"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Plus, ShieldCheck, RefreshCw, AlertCircle,
  Activity, FileText, CheckCircle2, XCircle,
  X, Send, Clock, Layers, Paperclip, Download,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import SubmitModal from "@/components/SubmitModal";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface ComplianceRow {
  id: string;
  name: string;
  template_name: string | null;
  due_date: string;
  status: string;
  current_level: number;
  total_levels: number;
  is_overdue: boolean;
  can_act: boolean;
  approval_level_id: string | null;
  assigned_user_id: string | null;
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

function parseSubmitRemarks(raw: string | null): { submitText: string | null; fileUrl: string | null } {
  if (!raw) return { submitText: null, fileUrl: null };
  const parts = raw.split(" | ");
  const filePart = parts.find((p) => p.startsWith("File: ")) ?? null;
  const textParts = parts.filter((p) => !p.startsWith("File: "));
  return {
    submitText: textParts.join(" | ") || null,
    fileUrl:    filePart ? filePart.slice("File: ".length) : null,
  };
}

function StatusBadge({ status, isOverdue }: { status: string; isOverdue: boolean }) {
  const label = isOverdue && status !== "APPROVED" ? "OVERDUE" : status;
  const cls   = STATUS_COLORS[label] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

/* ─── Details Modal ──────────────────────────────────────────────────────── */

function DetailsModal({
  row, onClose, onRefresh,
}: {
  row: ComplianceRow;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [data, setData]             = useState<DetailData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchErr, setFetchErr]     = useState("");
  const [remarks, setRemarks]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionErr, setActionErr]   = useState("");

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
  const { submitText, fileUrl } = parseSubmitRemarks(submittedLog?.remarks ?? null);

  async function handleAction(type: "approve" | "reject") {
    if (type === "reject" && !remarks.trim()) { setActionErr("Remarks are required when rejecting."); return; }
    if (!row.approval_level_id) return;
    setSubmitting(true);
    setActionErr("");
    try {
      const res = await fetch("/api/approvals/compliance/action", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_id: row.approval_level_id, action: type, remarks }),
      });
      const json = await res.json();
      if (!res.ok) { setActionErr(json.error ?? "Action failed."); setSubmitting(false); return; }
      onClose();
      onRefresh();
    } catch {
      setActionErr("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {loadingData ? (
                <div className="space-y-2">
                  <div className="h-5 w-52 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                </div>
              ) : data ? (
                <>
                  <h2 className="text-lg font-bold text-slate-900 truncate">{data.name}</h2>
                  {data.template?.title && (
                    <p className="text-xs text-slate-500 mt-0.5">{data.template.title}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <StatusBadge status={data.status} isOverdue={row.is_overdue} />
                    {data.due_date && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                        <Clock size={11} /> Due {fmtDate(data.due_date)}
                      </span>
                    )}
                    {(data.submitter_name ?? data.submitter_email) && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                        <Send size={11} /> {data.submitter_name ?? data.submitter_email}
                      </span>
                    )}
                  </div>
                </>
              ) : <p className="text-sm text-red-600">{fetchErr}</p>}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0" data-testid="btn-close-details-modal">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {loadingData ? (
            <div className="space-y-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
          ) : data ? (
            <>
              {/* 1 · Progress */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approval Progress</p>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                    Level {currentLevel} of {totalLevels}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-2 bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                </div>
                {totalLevels > 0 && (
                  <div className="flex justify-between mt-2.5">
                    {Array.from({ length: totalLevels }, (_, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors ${
                          i + 1 < currentLevel  ? "bg-blue-500 border-blue-500 text-white" :
                          i + 1 === currentLevel ? "bg-blue-600 border-blue-600 text-white ring-2 ring-blue-200" :
                          "bg-white border-slate-200 text-slate-400"
                        }`}>{i + 1}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2 · Submission Details */}
              {submittedLog && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Send size={11} /> Submission Details
                  </p>
                  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs font-medium text-slate-500">Submitted By</span>
                      <span className="text-xs font-semibold text-slate-800">
                        {data.submitter_name ?? data.submitter_email ?? submittedLog.actor_name ?? submittedLog.actor_email ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs font-medium text-slate-500">Submitted Date</span>
                      <span className="text-xs font-semibold text-slate-800">{fmtFull(submittedLog.timestamp)}</span>
                    </div>
                    {submitText && (
                      <div className="px-4 py-3">
                        <span className="text-xs font-medium text-slate-500 block mb-1.5">Remarks</span>
                        <p className="text-xs text-slate-700 italic bg-slate-50 rounded-lg px-3 py-2">"{submitText}"</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3 · Attachments */}
              {fileUrl && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Paperclip size={11} /> Attachments
                  </p>
                  <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-700 truncate">{fileUrl.split("/").pop() ?? "Attachment"}</span>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors shrink-0"
                    >
                      <Download size={11} /> Download / View
                    </a>
                  </div>
                </div>
              )}

              {/* 4 · Approval History */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Activity size={11} /> Approval History
                </p>
                <div className="space-y-2">
                  {Array.from({ length: Math.max(totalLevels, currentLevel) }, (_, i) => i + 1).map((lvl) => {
                    const log        = approvalLogs.find((l) => l.level_number === lvl) ?? null;
                    const isApproved = log?.action === "APPROVED";
                    const isRejected = log?.action === "REJECTED";
                    const isCurrent  = lvl === currentLevel && !log && data.status === "SUBMITTED";
                    return (
                      <div key={lvl} className={`rounded-xl border px-4 py-3 ${
                        isCurrent  ? "border-blue-200 bg-blue-50" :
                        isApproved ? "border-green-100 bg-green-50/50" :
                        isRejected ? "border-red-100 bg-red-50/50" :
                        "border-slate-100 bg-white"
                      }`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              isApproved ? "bg-green-500 text-white" :
                              isRejected ? "bg-red-500 text-white" :
                              isCurrent  ? "bg-blue-500 text-white" :
                              "bg-slate-200 text-slate-500"
                            }`}>{lvl}</div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate">
                                {log?.actor_name ?? log?.actor_email ?? (isCurrent ? "Awaiting approver" : "—")}
                              </p>
                              {log?.timestamp && (
                                <p className="text-[10px] text-slate-400 mt-0.5">{fmtFull(log.timestamp)}</p>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0">
                            {isApproved && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full"><CheckCircle2 size={10} />Approved</span>}
                            {isRejected && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full"><XCircle size={10} />Rejected</span>}
                            {isCurrent  && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full"><Clock size={10} className="animate-pulse" />Pending</span>}
                            {!log && !isCurrent && <span className="text-[10px] text-slate-400">Not reached</span>}
                          </div>
                        </div>
                        {log?.remarks && (
                          <p className="mt-2 text-[11px] text-slate-600 italic bg-white/70 rounded-lg px-3 py-1.5 border border-slate-100">"{log.remarks}"</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5 · Action Section (only if eligible) */}
              {row.can_act && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 space-y-3">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={12} /> Your Action
                  </p>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">
                      Remarks <span className="text-slate-400">(required when rejecting)</span>
                    </label>
                    <textarea
                      rows={3}
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
                      <AlertCircle size={12} className="mt-0.5 shrink-0" />{actionErr}
                    </div>
                  )}
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => handleAction("reject")}
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="btn-details-reject"
                    >
                      <XCircle size={14} />{submitting ? "Processing…" : "Reject"}
                    </button>
                    <button
                      onClick={() => handleAction("approve")}
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="btn-details-approve"
                    >
                      <CheckCircle2 size={14} />{submitting ? "Processing…" : "Approve"}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-red-600 text-sm py-4"><AlertCircle size={15} />{fetchErr}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function CompliancePage() {
  const { user } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [records, setRecords]   = useState<ComplianceRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const [detailsRow, setDetailsRow] = useState<ComplianceRow | null>(null);
  const [submitRow, setSubmitRow]   = useState<string | null>(null);

  const statusFilter = searchParams?.get("status") ?? null;

  const filteredRecords = useMemo(() => {
    if (!statusFilter) return records;
    const f = statusFilter.toLowerCase();
    if (f === "pending")   return records.filter((r) => r.status === "DRAFT" || r.status === "PENDING");
    if (f === "submitted") return records.filter((r) => r.status === "SUBMITTED");
    if (f === "approved")  return records.filter((r) => r.status === "APPROVED");
    if (f === "rejected")  return records.filter((r) => r.status === "REJECTED");
    if (f === "overdue")   return records.filter((r) => r.is_overdue);
    return records;
  }, [records, statusFilter]);

  const canCreate = user?.role && ["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(user.role);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/compliance/all", { credentials: "include" });
      if (res.status === 401) { router.push("/auth/login"); return; }
      if (!res.ok) { setError("Failed to load compliance records."); return; }
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const stats = {
    total:     records.length,
    submitted: records.filter((r) => r.status === "SUBMITTED").length,
    approved:  records.filter((r) => r.status === "APPROVED").length,
    overdue:   records.filter((r) => r.is_overdue).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compliance</h1>
          <p className="text-sm text-slate-500 mt-0.5">All compliance records across all statuses</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRecords}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            data-testid="btn-refresh"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          {canCreate && (
            <Link
              href="/compliance/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              data-testid="btn-new-compliance"
            >
              <Plus size={15} /> New Compliance
            </Link>
          )}
        </div>
      </div>

      {/* Stat pills */}
      {!loading && records.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Total",     val: stats.total,     cls: "bg-slate-100 text-slate-700" },
            { label: "Submitted", val: stats.submitted, cls: "bg-yellow-100 text-yellow-700" },
            { label: "Approved",  val: stats.approved,  cls: "bg-green-100 text-green-700" },
            { label: "Overdue",   val: stats.overdue,   cls: "bg-orange-100 text-orange-700" },
          ].map(({ label, val, cls }) => (
            <span key={label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cls}`}>
              {label}: {val}
            </span>
          ))}
        </div>
      )}

      {/* Active filter banner */}
      {statusFilter && !loading && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-2.5 rounded-xl">
          <span>Showing <strong>{statusFilter}</strong> records ({filteredRecords.length})</span>
          <Link href="/compliance" className="inline-flex items-center gap-1 text-xs font-medium hover:underline">
            <X size={12} /> Clear filter
          </Link>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertCircle size={15} />{error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
          </div>
        </div>
      ) : records.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
          <div className="p-4 bg-slate-50 rounded-full mb-4">
            <ShieldCheck size={32} className="text-slate-400" />
          </div>
          <p className="text-slate-700 font-medium">No compliance records found</p>
          <p className="text-slate-400 text-sm mt-1">Create your first compliance record to get started.</p>
          {canCreate && (
            <Link href="/compliance/create" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={14} /> Create Compliance
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Due Date</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Level</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors" data-testid={`row-compliance-${r.id}`}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{r.name}</p>
                      {r.template_name && <p className="text-xs text-slate-400 mt-0.5">{r.template_name}</p>}
                    </td>
                    <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                      <span className={r.is_overdue ? "text-orange-600 font-medium" : ""}>
                        {fmtDate(r.due_date)}
                      </span>
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
                        {/* Submit */}
                        {(r.status === "DRAFT" || r.status === "SUBMITTED" || r.status === "APPROVED") && r.assigned_user_id === user?.id && (
                          <button
                            onClick={() => (r.status === "DRAFT" ? setSubmitRow(r.id) : undefined)}
                            disabled={r.status === "SUBMITTED" || r.status === "APPROVED"}
                            title={r.status !== "DRAFT" ? "Already submitted" : undefined}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                              r.status === "DRAFT"
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            }`}
                            data-testid={`btn-submit-${r.id}`}
                          >
                            <Send size={12} /> Submit
                          </button>
                        )}
                        {/* Details */}
                        <button
                          onClick={() => setDetailsRow(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-blue-200 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors"
                          data-testid={`btn-details-${r.id}`}
                        >
                          <FileText size={12} /> Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {detailsRow && (
        <DetailsModal row={detailsRow} onClose={() => setDetailsRow(null)} onRefresh={fetchRecords} />
      )}
      {submitRow && (
        <SubmitModal
          endpoint={`/api/compliance/${submitRow}/submit`}
          title="Submit Compliance"
          onClose={() => setSubmitRow(null)}
          onSuccess={fetchRecords}
        />
      )}
    </div>
  );
}

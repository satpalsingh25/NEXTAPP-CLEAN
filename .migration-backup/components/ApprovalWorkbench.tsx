"use client";

import { useState, useCallback, useEffect } from "react";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, ChevronDown, ChevronUp,
  User, Calendar, Layers, History, RefreshCw, Inbox, ShieldCheck, Wrench,
} from "lucide-react";

export type HistoryEntry = {
  id: string;
  level: number;
  action: "APPROVED" | "REJECTED" | "SUBMITTED";
  remarks: string;
  acted_by: { id: string; name: string | null; email: string } | null;
  acted_at: string;
};

export type PendingRecord = {
  id: string;
  module: "COMPLIANCE" | "AMC";
  title: string;
  due_date: string | null;
  is_overdue: boolean;
  status: string;
  current_level: number;
  total_levels: number;
  template: { id: string; title: string; approval_levels: number } | null;
  submitter_name: string | null;
  submitter_email: string | null;
  created_at: string;
  is_assigned: boolean;
  history: HistoryEntry[];
  asset?: { id: string; name: string } | null;
  vendor?: { id: string; name: string } | null;
};

type Props = {
  module: "COMPLIANCE" | "AMC";
  apiBase: string;
  onLoad?: () => void;
};

function OverdueBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
      <AlertTriangle size={10} />
      OVERDUE
    </span>
  );
}

function LevelProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full min-w-[16px] ${
            i < current ? "bg-emerald-400" : "bg-slate-200"
          }`}
        />
      ))}
      <span className="text-xs text-slate-500 shrink-0 ml-0.5">
        {current}/{total}
      </span>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  if (action === "APPROVED")
    return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">Approved</span>;
  if (action === "REJECTED")
    return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Rejected</span>;
  return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Submitted</span>;
}

function RecordCard({
  record,
  onAction,
}: {
  record: PendingRecord;
  onAction: (id: string, action: "approve" | "reject", remarks: string) => Promise<void>;
}) {
  const [remarks, setRemarks] = useState("");
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleAction = async (action: "approve" | "reject") => {
    if (!remarks.trim()) {
      setError("Remarks are required before taking action.");
      return;
    }
    setError(null);
    setActing(action);
    await onAction(record.id, action, remarks.trim());
    setActing(null);
  };

  const dueDateStr = record.due_date
    ? new Date(record.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
        record.is_assigned ? "border-slate-200 hover:border-blue-300" : "border-slate-100 opacity-80"
      }`}
    >
      {/* Card header */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                record.module === "COMPLIANCE" ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700"
              }`}>
                {record.module === "COMPLIANCE" ? <ShieldCheck size={11} /> : <Wrench size={11} />}
                {record.module}
              </span>
              {record.is_overdue && <OverdueBadge />}
              {!record.is_assigned && (
                <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-500">View only</span>
              )}
            </div>
            <h3 className="mt-1.5 text-sm font-semibold text-slate-900 truncate" title={record.title}>
              {record.title}
            </h3>
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <User size={12} />
            {record.submitter_name
              ? `${record.submitter_name}${record.submitter_email ? ` · ${record.submitter_email}` : ""}`
              : record.submitter_email ?? <span className="italic">Unknown submitter</span>}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar size={12} />
            <span className={record.is_overdue ? "text-red-600 font-medium" : ""}>{dueDateStr}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Layers size={12} />
            Level {record.current_level} of {record.total_levels}
          </span>
        </div>

        {/* Progress */}
        <div className="mt-3">
          <LevelProgress current={record.current_level} total={record.total_levels} />
        </div>
      </div>

      {/* History accordion */}
      {record.history.length > 0 && (
        <div className="border-b border-slate-100">
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <History size={12} />
              Approval history ({record.history.length})
            </span>
            {historyOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {historyOpen && (
            <div className="px-5 pb-3 space-y-2">
              {record.history.map((h) => (
                <div key={h.id} className="flex gap-3 text-xs">
                  <div className="flex flex-col items-center pt-0.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                      h.action === "APPROVED" ? "bg-emerald-500" : "bg-red-500"
                    }`}>
                      {h.level}
                    </div>
                    <div className="w-px flex-1 bg-slate-200 mt-1" />
                  </div>
                  <div className="pb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <ActionBadge action={h.action} />
                      <span className="text-slate-500">
                        {h.acted_by?.name ?? h.acted_by?.email ?? "Unknown"}
                      </span>
                      <span className="text-slate-400">
                        {new Date(h.acted_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </div>
                    {h.remarks && (
                      <p className="mt-1 text-slate-600 bg-slate-50 rounded px-2 py-1 border border-slate-200">
                        {h.remarks}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action panel — only for assigned approver */}
      {record.is_assigned && (
        <div className="px-5 py-4 bg-slate-50 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => { setRemarks(e.target.value); setError(null); }}
              placeholder="Enter your remarks before approving or rejecting…"
              className="w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAction("approve")}
              disabled={!!acting}
              data-testid={`btn-approve-${record.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors"
            >
              <CheckCircle2 size={13} />
              {acting === "approve" ? "Approving…" : "Approve"}
            </button>
            <button
              onClick={() => handleAction("reject")}
              disabled={!!acting}
              data-testid={`btn-reject-${record.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-red-600 border border-red-300 text-xs font-semibold rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors"
            >
              <XCircle size={13} />
              {acting === "reject" ? "Rejecting…" : "Reject"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ApprovalWorkbench({ module, apiBase }: Props) {
  const [records, setRecords] = useState<PendingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"assigned" | "all">("assigned");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${apiBase}/pending-approval`)
      .then((r) => r.json())
      .then((d) => { setRecords(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [apiBase]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (recordId: string, action: "approve" | "reject", remarks: string) => {
    const res = await fetch(`${apiBase}/${recordId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remarks }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Record ${action === "approve" ? "approved" : "rejected"} successfully.`, true);
      load();
    } else {
      showToast(data.error || `Failed to ${action}.`, false);
    }
  };

  const displayed = tab === "assigned"
    ? records.filter((r) => r.is_assigned)
    : records;

  const assignedCount = records.filter((r) => r.is_assigned).length;

  const isCompliance = module === "COMPLIANCE";
  const label = isCompliance ? "Compliance" : "AMC";

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {label} Pending Approvals
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Review and act on {label.toLowerCase()} records awaiting approval
          </p>
        </div>
        <button
          onClick={load}
          data-testid="btn-refresh-pending"
          className="self-start p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("assigned")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "assigned"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          My Queue
          {assignedCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold bg-blue-600 text-white">
              {assignedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("all")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "all"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          All Submitted
          <span className="ml-2 inline-flex items-center justify-center px-1.5 h-4 rounded-full text-[10px] font-semibold bg-slate-300 text-slate-700">
            {records.length}
          </span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="h-16 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 text-slate-400">
          <Inbox size={44} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">
            {tab === "assigned" ? "No records assigned to you" : "No submitted records"}
          </p>
          {tab === "assigned" && (
            <p className="text-xs mt-1 text-slate-400">Switch to "All Submitted" to view all pending records</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map((record) => (
            <RecordCard key={record.id} record={record} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Wrench, RefreshCw, Loader2, AlertCircle } from "lucide-react";

interface AMCApproval {
  id: string;
  name: string;
  status: string;
  current_level: number;
  submitted_at: string | null;
  amcTemplate: { id: string; name: string; approval_levels: number } | null;
  submitted_by_user: { id: string; name?: string | null; email: string } | null;
  assignedUser: { id: string; name?: string | null; email: string } | null;
}

const CREDS = { credentials: "include" } as const;

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    SUBMITTED: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export default function AMCApprovalsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<AMCApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  const [actId, setActId]         = useState("");
  const [actRemarks, setActRemarks] = useState("");
  const [actError, setActError]   = useState("");
  const [actLoading, setActLoading] = useState(false);

  const fetchRecords = useCallback(() => {
    setLoading(true);
    fetch("/api/amc/approvals", CREDS)
      .then(async (r) => {
        if (r.status === 401) { router.push("/auth/login"); return; }
        if (r.status === 403) { setError("You do not have permission to view this page."); return; }
        if (!r.ok) { setError("Failed to load approval inbox."); return; }
        const data = await r.json();
        setRecords(Array.isArray(data) ? data : []);
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  async function doAction(id: string, action: "approve" | "reject") {
    if (!actRemarks.trim()) { setActError("Remarks are required."); return; }
    setActError("");
    setActLoading(true);
    try {
      const res = await fetch(`/api/amc/${id}/${action}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        ...CREDS,
        body: JSON.stringify({ remarks: actRemarks }),
      });
      const data = await res.json();
      if (!res.ok) { setActError(data.error || "Action failed."); return; }
      setActId("");
      setActRemarks("");
      fetchRecords();
    } catch {
      setActError("Network error.");
    } finally {
      setActLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AMC Approval Inbox</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? "Loading…" : `${records.length} record${records.length !== 1 ? "s" : ""} pending your approval`}
          </p>
        </div>
        <button
          onClick={fetchRecords}
          disabled={loading}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {actError && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg" data-testid="error-action">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{actError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : records.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
          <div className="p-4 bg-emerald-50 rounded-full mb-4">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <p className="text-slate-700 font-medium">All caught up!</p>
          <p className="text-slate-400 text-sm mt-1">No AMC records are pending your approval.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" data-testid={`card-amc-${r.id}`}>
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-emerald-50 rounded-lg shrink-0">
                    <Wrench className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{r.name || "Untitled"}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{r.amcTemplate?.name ?? "No template"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={r.status} />
                  <span className="text-xs text-slate-400 whitespace-nowrap">Level {r.current_level}</span>
                </div>
              </div>

              <div className="px-5 pb-4 grid grid-cols-2 gap-3 text-sm border-t border-slate-50 pt-3">
                <div>
                  <span className="text-xs text-slate-400">Submitted By</span>
                  <p className="text-slate-700 mt-0.5">
                    {r.submitted_by_user ? (r.submitted_by_user.name || r.submitted_by_user.email) : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Submitted At</span>
                  <p className="text-slate-700 mt-0.5">{fmtDate(r.submitted_at)}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Total Levels</span>
                  <p className="text-slate-700 mt-0.5">{r.amcTemplate?.approval_levels ?? "—"}</p>
                </div>
                {r.assignedUser && (
                  <div>
                    <span className="text-xs text-slate-400">Assigned To</span>
                    <p className="text-slate-700 mt-0.5">{r.assignedUser.name || r.assignedUser.email}</p>
                  </div>
                )}
              </div>

              {/* Action panel */}
              {actId === r.id ? (
                <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 space-y-3">
                  <textarea
                    value={actRemarks}
                    onChange={(e) => setActRemarks(e.target.value)}
                    rows={3}
                    placeholder="Add your remarks (required)…"
                    data-testid={`input-remarks-${r.id}`}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => doAction(r.id, "approve")}
                      disabled={actLoading || !actRemarks.trim()}
                      data-testid={`btn-approve-${r.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {actLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => doAction(r.id, "reject")}
                      disabled={actLoading || !actRemarks.trim()}
                      data-testid={`btn-reject-${r.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {actLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </button>
                    <button
                      onClick={() => { setActId(""); setActRemarks(""); setActError(""); }}
                      className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-3">
                  <button
                    onClick={() => { setActId(r.id); setActRemarks(""); setActError(""); }}
                    data-testid={`btn-act-${r.id}`}
                    className="text-sm font-medium text-emerald-600 hover:underline"
                  >
                    Approve / Reject
                  </button>
                  <span className="text-slate-300">·</span>
                  <Link href={`/amc/${r.id}`} className="text-sm text-slate-500 hover:underline">
                    View Details
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

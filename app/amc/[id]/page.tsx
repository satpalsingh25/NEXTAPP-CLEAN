"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Circle,
  FileText,
  Send,
  Wrench,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface ApprovalLog {
  id: string;
  level_number: number;
  action: "SUBMITTED" | "APPROVED" | "REJECTED";
  actor_email: string | null;
  timestamp: string;
  remarks: string | null;
}

interface AMCDetail {
  id: string;
  name: string;
  status: string;
  current_level: number;
  created_at: string;
  due_date: string | null;
  expiry_date: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  assigned_user_id: string | null;
  submitter_email: string | null;
  approver_email: string | null;
  amcTemplate: { id: string; name: string; approval_levels: number; frequency: string } | null;
  asset:  { id: string; name: string } | null;
  vendor: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  businessFunction: { id: string; name: string } | null;
  assignedUser: { id: string; name?: string | null; email: string } | null;
  approval_levels: { id: string; level: number; approver_id: string }[];
  approval_logs: ApprovalLog[];
}

type StepStatus = "done" | "rejected" | "active" | "pending";
interface TimelineStep {
  key: string;
  label: string;
  status: StepStatus;
  timestamp?: string;
  actor?: string | null;
  remarks?: string | null;
}

function buildSteps(record: AMCDetail): TimelineStep[] {
  const logs = record.approval_logs;
  const approvalLevels = record.amcTemplate?.approval_levels ?? 0;
  const isFinalRejected = record.status === "REJECTED";
  const isFinalApproved = record.status === "APPROVED";
  const submittedLog = logs.find((l) => l.action === "SUBMITTED");
  const steps: TimelineStep[] = [];

  steps.push({ key: "draft", label: "Draft Created", status: "done", timestamp: record.created_at });
  steps.push({
    key: "submitted",
    label: "Submitted for Approval",
    status: submittedLog ? "done" : record.status === "DRAFT" ? "active" : "done",
    timestamp: submittedLog?.timestamp,
    actor: submittedLog?.actor_email ?? record.submitter_email,
  });

  for (let lvl = 1; lvl <= approvalLevels; lvl++) {
    const approvedLog = logs.find((l) => l.action === "APPROVED" && l.level_number === lvl);
    const rejectedLog = logs.find((l) => l.action === "REJECTED" && l.level_number === lvl);
    let stepStatus: StepStatus = "pending";
    if (rejectedLog) stepStatus = "rejected";
    else if (approvedLog) stepStatus = "done";
    else if (!isFinalRejected && !isFinalApproved && record.current_level === lvl && record.status === "SUBMITTED") stepStatus = "active";

    steps.push({
      key: `level-${lvl}`,
      label: `Level ${lvl} Approval`,
      status: stepStatus,
      timestamp: rejectedLog?.timestamp ?? approvedLog?.timestamp,
      actor: rejectedLog?.actor_email ?? approvedLog?.actor_email,
      remarks: rejectedLog?.remarks ?? approvedLog?.remarks,
    });
  }

  if (isFinalApproved) {
    steps.push({
      key: "final-approved",
      label: "Final Approval Granted",
      status: "done",
      timestamp: logs.find((l) => l.action === "APPROVED" && l.level_number === approvalLevels)?.timestamp,
      actor: record.approver_email,
    });
  } else if (isFinalRejected) {
    const rejLog = logs.find((l) => l.action === "REJECTED");
    steps.push({
      key: "final-rejected",
      label: "Rejected",
      status: "rejected",
      timestamp: rejLog?.timestamp,
      actor: rejLog?.actor_email ?? record.approver_email,
      remarks: rejLog?.remarks,
    });
  } else {
    steps.push({ key: "final-pending", label: "Final Approval Pending", status: "pending" });
  }
  return steps;
}

const fmt = (ts?: string | null) =>
  ts ? new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done")     return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
  if (status === "rejected") return <XCircle className="w-6 h-6 text-red-500" />;
  if (status === "active")   return <Clock className="w-6 h-6 text-yellow-500 animate-pulse" />;
  return <Circle className="w-6 h-6 text-gray-300" />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-600",
    SUBMITTED: "bg-yellow-100 text-yellow-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    APPROVED: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-red-100 text-red-700",
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>{status}</span>;
}

export default function AMCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [record, setRecord] = useState<AMCDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actRemarks, setActRemarks] = useState("");
  const [actError,   setActError]   = useState("");
  const [actLoading, setActLoading] = useState(false);

  const fetchRecord = () => {
    setLoading(true);
    fetch(`/api/amc/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (data.error) setError(data.error); else setRecord(data); })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRecord(); }, [id]);

  const isAssignedUser = user && record && (
    record.assigned_user_id === user.id || record.submitted_by === user.id
  );

  const canSubmit = record?.status === "DRAFT" && isAssignedUser;
  const canResubmit = record?.status === "REJECTED" && isAssignedUser;
  const currentLevelEntry = record?.approval_levels.find((al) => al.level === record?.current_level);
  const canApprove = record?.status === "SUBMITTED" && currentLevelEntry?.approver_id === user?.id;

  async function doAction(endpoint: string, body: object) {
    setActError("");
    setActLoading(true);
    try {
      const res = await fetch(`/api/amc/${id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setActError(data.error || "Action failed."); return; }
      setActRemarks("");
      fetchRecord();
    } catch {
      setActError("Network error.");
    } finally {
      setActLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-500">
        {error ?? "Record not found"}
      </div>
    );
  }

  const steps = buildSteps(record);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700" data-testid="btn-back">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Header card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Wrench className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{record.name || "AMC Record"}</h1>
                {record.amcTemplate?.name && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {record.amcTemplate.name}
                    {record.amcTemplate.frequency && (
                      <> &middot; {record.amcTemplate.frequency}</>
                    )}
                  </p>
                )}
              </div>
            </div>
            <StatusBadge status={record.status} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
            {record.department && (
              <div>
                <span className="text-gray-500">Department</span>
                <p className="font-medium text-gray-800 mt-0.5">{record.department.name}</p>
              </div>
            )}
            {record.businessFunction && (
              <div>
                <span className="text-gray-500">Function</span>
                <p className="font-medium text-gray-800 mt-0.5">{record.businessFunction.name}</p>
              </div>
            )}
            {record.assignedUser && (
              <div>
                <span className="text-gray-500">Assigned To</span>
                <p className="font-medium text-gray-800 mt-0.5">{record.assignedUser.name || record.assignedUser.email}</p>
              </div>
            )}
            {record.asset && (
              <div>
                <span className="text-gray-500">Asset</span>
                <p className="font-medium text-gray-800 mt-0.5">{record.asset.name}</p>
              </div>
            )}
            {record.vendor && (
              <div>
                <span className="text-gray-500">Vendor</span>
                <p className="font-medium text-gray-800 mt-0.5">{record.vendor.name}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500">Due Date</span>
              <p className="font-medium text-gray-800 mt-0.5">
                {record.due_date || record.expiry_date
                  ? new Date((record.due_date ?? record.expiry_date)!).toLocaleDateString("en-IN")
                  : "—"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Approval Levels</span>
              <p className="font-medium text-gray-800 mt-0.5">{record.amcTemplate?.approval_levels ?? "—"}</p>
            </div>
            {record.submitter_email && (
              <div>
                <span className="text-gray-500">Submitted By</span>
                <p className="font-medium text-gray-800 mt-0.5">{record.submitter_email}</p>
              </div>
            )}
            {record.submitted_at && (
              <div>
                <span className="text-gray-500">Submitted At</span>
                <p className="font-medium text-gray-800 mt-0.5">{fmt(record.submitted_at)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action panel */}
        {(canSubmit || canResubmit || canApprove) && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Actions</h2>

            {actError && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg" data-testid="error-action">
                {actError}
              </div>
            )}

            {(canApprove) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks (required)</label>
                <textarea
                  value={actRemarks}
                  onChange={(e) => setActRemarks(e.target.value)}
                  rows={3}
                  placeholder="Add your remarks…"
                  data-testid="input-remarks"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {canSubmit && (
                <button
                  onClick={() => doAction("submit", {})}
                  disabled={actLoading}
                  data-testid="btn-submit"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {actLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit for Approval
                </button>
              )}
              {canResubmit && (
                <button
                  onClick={() => doAction("resubmit", {})}
                  disabled={actLoading}
                  data-testid="btn-resubmit"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {actLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Resubmit
                </button>
              )}
              {canApprove && (
                <>
                  <button
                    onClick={() => doAction("approve", { remarks: actRemarks })}
                    disabled={actLoading || !actRemarks.trim()}
                    data-testid="btn-approve"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {actLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Approve
                  </button>
                  <button
                    onClick={() => doAction("reject", { remarks: actRemarks })}
                    disabled={actLoading || !actRemarks.trim()}
                    data-testid="btn-reject"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {actLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-500" />
            Approval Timeline
          </h2>
          <div className="relative">
            {steps.map((step, idx) => {
              const isLast = idx === steps.length - 1;
              return (
                <div key={step.key} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex-shrink-0"><StepIcon status={step.status} /></div>
                    {!isLast && (
                      <div className={`w-0.5 flex-1 mt-1 mb-1 min-h-[2rem] ${
                        step.status === "done" ? "bg-emerald-200" : step.status === "rejected" ? "bg-red-200" : "bg-gray-200"
                      }`} />
                    )}
                  </div>
                  <div className={`pb-6 flex-1 ${isLast ? "pb-0" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`font-semibold text-sm ${
                          step.status === "done" ? "text-gray-900" : step.status === "rejected" ? "text-red-600" : step.status === "active" ? "text-yellow-700" : "text-gray-400"
                        }`}>{step.label}</p>
                        {step.actor && (
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                            <Send className="w-3 h-3" />{step.actor}
                          </p>
                        )}
                        {step.remarks && (
                          <p className="text-xs text-gray-500 italic mt-1 bg-gray-50 border border-gray-100 rounded px-2 py-1">
                            &ldquo;{step.remarks}&rdquo;
                          </p>
                        )}
                      </div>
                      {step.timestamp && (
                        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{fmt(step.timestamp)}</span>
                      )}
                    </div>
                    {step.status === "active" && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full px-2.5 py-0.5">
                        <Clock className="w-3 h-3" />Awaiting action
                      </div>
                    )}
                    {step.status === "pending" && idx > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs bg-gray-50 text-gray-400 border border-gray-200 rounded-full px-2.5 py-0.5">
                        <Circle className="w-3 h-3" />Not yet started
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-center">
          <Link href="/amc" className="text-sm text-emerald-500 hover:underline">← Back to AMC List</Link>
        </div>
      </div>
    </div>
  );
}

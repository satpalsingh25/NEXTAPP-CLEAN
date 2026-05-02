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
  ShieldCheck,
} from "lucide-react";

interface ApprovalLog {
  id: string;
  level_number: number;
  action: "SUBMITTED" | "APPROVED" | "REJECTED";
  actor_email: string | null;
  timestamp: string;
  remarks: string | null;
}

interface ComplianceDetail {
  id: string;
  name: string;
  status: string;
  current_level: number;
  created_at: string;
  due_date: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  submitter_email: string | null;
  approver_email: string | null;
  template: {
    id: string;
    title: string;
    approval_levels: number;
    frequency: string;
  } | null;
  approval_logs: ApprovalLog[];
}

type StepStatus = "done" | "rejected" | "active" | "pending";

interface TimelineStep {
  key: string;
  label: string;
  sublabel?: string;
  status: StepStatus;
  timestamp?: string;
  actor?: string | null;
  remarks?: string | null;
}

function buildSteps(record: ComplianceDetail): TimelineStep[] {
  const logs = record.approval_logs;
  const approvalLevels = record.template?.approval_levels ?? 0;
  const isFinalRejected = record.status === "REJECTED";
  const isFinalApproved = record.status === "APPROVED";

  const submittedLog = logs.find((l) => l.action === "SUBMITTED");

  const steps: TimelineStep[] = [];

  // Step 1: Draft
  steps.push({
    key: "draft",
    label: "Draft Created",
    status: "done",
    timestamp: record.created_at,
  });

  // Step 2: Submitted
  steps.push({
    key: "submitted",
    label: "Submitted for Approval",
    status: submittedLog ? "done" : record.status === "DRAFT" ? "active" : "done",
    timestamp: submittedLog?.timestamp,
    actor: submittedLog?.actor_email ?? record.submitter_email,
  });

  // Step 3..N: Each approval level
  for (let lvl = 1; lvl <= approvalLevels; lvl++) {
    const approvedLog = logs.find((l) => l.action === "APPROVED" && l.level_number === lvl);
    const rejectedLog = logs.find((l) => l.action === "REJECTED" && l.level_number === lvl);

    let stepStatus: StepStatus = "pending";
    if (rejectedLog) {
      stepStatus = "rejected";
    } else if (approvedLog) {
      stepStatus = "done";
    } else if (!isFinalRejected && !isFinalApproved && record.current_level === lvl && record.status === "SUBMITTED") {
      stepStatus = "active";
    }

    steps.push({
      key: `level-${lvl}`,
      label: `Level ${lvl} Approval`,
      sublabel: approvalLevels > 1 ? `Level ${lvl} of ${approvalLevels}` : undefined,
      status: stepStatus,
      timestamp: rejectedLog?.timestamp ?? approvedLog?.timestamp,
      actor: rejectedLog?.actor_email ?? approvedLog?.actor_email,
      remarks: rejectedLog?.remarks ?? approvedLog?.remarks,
    });
  }

  // Final outcome step
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
    steps.push({
      key: "final-pending",
      label: "Final Approval Pending",
      status: "pending",
    });
  }

  return steps;
}

function fmt(ts?: string) {
  if (!ts) return null;
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done")
    return <CheckCircle2 className="w-6 h-6 text-blue-500" />;
  if (status === "rejected")
    return <XCircle className="w-6 h-6 text-red-500" />;
  if (status === "active")
    return <Clock className="w-6 h-6 text-yellow-500 animate-pulse" />;
  return <Circle className="w-6 h-6 text-gray-300" />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-600",
    SUBMITTED: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-blue-100 text-blue-700",
    REJECTED: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export default function ComplianceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<ComplianceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/compliance/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRecord(data);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
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
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
          data-testid="btn-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Header card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <ShieldCheck className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {record.name || record.template?.title || "Compliance Record"}
                </h1>
                {record.template?.title && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {record.template.title}
                    {record.template.frequency && (
                      <> &middot; {record.template.frequency}</>
                    )}
                  </p>
                )}
              </div>
            </div>
            <StatusBadge status={record.status} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Due Date</span>
              <p className="font-medium text-gray-800 mt-0.5">
                {record.due_date ? new Date(record.due_date).toLocaleDateString("en-IN") : "—"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Approval Levels</span>
              <p className="font-medium text-gray-800 mt-0.5">
                {record.template?.approval_levels ?? "—"}
              </p>
            </div>
            {record.submitter_email && (
              <div>
                <span className="text-gray-500">Submitted By</span>
                <p className="font-medium text-gray-800 mt-0.5">{record.submitter_email}</p>
              </div>
            )}
            {record.approver_email && (
              <div>
                <span className="text-gray-500">Final Action By</span>
                <p className="font-medium text-gray-800 mt-0.5">{record.approver_email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            Approval Timeline
          </h2>

          <div className="relative">
            {steps.map((step, idx) => {
              const isLast = idx === steps.length - 1;
              return (
                <div key={step.key} className="flex gap-4">
                  {/* Left column: icon + connector */}
                  <div className="flex flex-col items-center">
                    <div className="flex-shrink-0">
                      <StepIcon status={step.status} />
                    </div>
                    {!isLast && (
                      <div
                        className={`w-0.5 flex-1 mt-1 mb-1 min-h-[2rem] ${
                          step.status === "done"
                            ? "bg-blue-200"
                            : step.status === "rejected"
                            ? "bg-red-200"
                            : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>

                  {/* Right column: content */}
                  <div className={`pb-6 flex-1 ${isLast ? "pb-0" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className={`font-semibold text-sm ${
                            step.status === "done"
                              ? "text-gray-900"
                              : step.status === "rejected"
                              ? "text-red-600"
                              : step.status === "active"
                              ? "text-yellow-700"
                              : "text-gray-400"
                          }`}
                        >
                          {step.label}
                        </p>
                        {step.actor && (
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                            <Send className="w-3 h-3" />
                            {step.actor}
                          </p>
                        )}
                        {step.remarks && (
                          <p className="text-xs text-gray-500 italic mt-1 bg-gray-50 border border-gray-100 rounded px-2 py-1">
                            &ldquo;{step.remarks}&rdquo;
                          </p>
                        )}
                      </div>
                      {step.timestamp && (
                        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                          {fmt(step.timestamp)}
                        </span>
                      )}
                    </div>

                    {step.status === "active" && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full px-2.5 py-0.5">
                        <Clock className="w-3 h-3" />
                        Awaiting action
                      </div>
                    )}
                    {step.status === "pending" && idx > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs bg-gray-50 text-gray-400 border border-gray-200 rounded-full px-2.5 py-0.5">
                        <Circle className="w-3 h-3" />
                        Not yet started
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Link back */}
        <div className="mt-4 text-center">
          <Link href="/compliance" className="text-sm text-blue-500 hover:underline">
            ← Back to Compliance List
          </Link>
        </div>
      </div>
    </div>
  );
}

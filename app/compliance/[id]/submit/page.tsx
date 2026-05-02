"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send, ShieldCheck, Calendar, Tag, AlertCircle } from "lucide-react";

interface ComplianceDetail {
  id: string;
  name: string;
  status: string;
  current_level: number;
  due_date: string | null;
  template: { id: string; title: string; approval_levels: number } | null;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const STATUS_BADGE: Record<string, string> = {
  DRAFT:     "bg-slate-100 text-slate-600",
  PENDING:   "bg-yellow-100 text-yellow-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED:  "bg-green-100 text-green-700",
  REJECTED:  "bg-red-100 text-red-700",
  OVERDUE:   "bg-orange-100 text-orange-700",
};

export default function ComplianceSubmitPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [record,    setRecord]    = useState<ComplianceDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState("");
  const [remarks,   setRemarks]   = useState("");
  const [fileUrl,   setFileUrl]   = useState("");

  useEffect(() => {
    fetch(`/api/compliance/${id}`, { credentials: "include" })
      .then((r) => {
        if (r.status === 401) { router.push("/auth/login"); return null; }
        if (!r.ok) throw new Error("Failed to load record");
        return r.json();
      })
      .then((data) => { if (data) setRecord(data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/compliance/${id}/submit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks, file_url: fileUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Submission failed"); return; }
      router.push("/compliance/my");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <p className="text-slate-500">Record not found.</p>
        <Link href="/compliance/my" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
          Back to My Compliance
        </Link>
      </div>
    );
  }

  const statusKey = record.status.toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/compliance/my"
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
          data-testid="btn-back"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Submit Compliance</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review details and confirm submission</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <ShieldCheck size={20} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-lg leading-tight" data-testid="text-name">
              {record.name || <span className="italic text-slate-400">Untitled</span>}
            </p>
            {record.template?.title && (
              <p className="text-sm text-slate-500 mt-0.5" data-testid="text-template">
                {record.template.title}
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[statusKey] ?? "bg-slate-100 text-slate-600"}`}
            data-testid="badge-status"
          >
            {record.status.charAt(0) + record.status.slice(1).toLowerCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar size={15} className="text-slate-400 shrink-0" />
            <span>Due:</span>
            <span className="font-medium text-slate-800" data-testid="text-due-date">
              {record.due_date ? fmtDate(record.due_date) : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Tag size={15} className="text-slate-400 shrink-0" />
            <span>Levels:</span>
            <span className="font-medium text-slate-800">
              {record.template?.approval_levels ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span data-testid="text-error">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="text-base font-semibold text-slate-800">Submission Details</h2>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700" htmlFor="remarks">
            Remarks
          </label>
          <textarea
            id="remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={4}
            placeholder="Add any notes or comments for the approver..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition"
            data-testid="input-remarks"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700" htmlFor="file_url">
            File URL <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="file_url"
            type="url"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://example.com/document.pdf"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            data-testid="input-file-url"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <Link
            href="/compliance/my"
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            data-testid="btn-cancel"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
            data-testid="btn-submit"
          >
            <Send size={15} />
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}

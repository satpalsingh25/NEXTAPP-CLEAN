"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wrench, Clock, CheckCircle2, AlertTriangle, FileCheck } from "lucide-react";

interface MyAMC {
  id: string;
  name: string;
  due_date: string;
  status: string;
  current_level: number;
}

type Tab = "upcoming" | "pending" | "submitted" | "overdue";

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

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[status.toUpperCase()] ?? "bg-slate-100 text-slate-600"}`}
      data-testid={`badge-status-${status}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "upcoming",  label: "Upcoming",  icon: <Clock size={14} /> },
  { key: "pending",   label: "Pending",   icon: <AlertTriangle size={14} /> },
  { key: "submitted", label: "Submitted", icon: <FileCheck size={14} /> },
  { key: "overdue",   label: "Overdue",   icon: <AlertTriangle size={14} /> },
];

function filterByTab(records: MyAMC[], tab: Tab): MyAMC[] {
  const now = new Date();
  switch (tab) {
    case "upcoming":
      return records.filter(
        (r) => r.due_date && new Date(r.due_date) >= now && r.status.toUpperCase() !== "APPROVED"
      );
    case "pending":
      return records.filter((r) =>
        ["DRAFT", "PENDING", "REJECTED"].includes(r.status.toUpperCase())
      );
    case "submitted":
      return records.filter((r) => r.status.toUpperCase() === "SUBMITTED");
    case "overdue":
      return records.filter((r) => r.status.toUpperCase() === "OVERDUE");
  }
}

function ActionCell({ record }: { record: MyAMC }) {
  const s = record.status.toUpperCase();

  if (s === "OVERDUE") {
    return (
      <Link
        href={`/amc/${record.id}/submit`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 transition-colors"
        data-testid={`btn-submit-late-${record.id}`}
      >
        Submit (Late)
      </Link>
    );
  }

  if (["DRAFT", "PENDING"].includes(s)) {
    return (
      <Link
        href={`/amc/${record.id}/submit`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        data-testid={`btn-submit-${record.id}`}
      >
        Submit
      </Link>
    );
  }

  return (
    <Link
      href={`/amc/${record.id}`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
      data-testid={`btn-view-${record.id}`}
    >
      View
    </Link>
  );
}

export default function MyAMCPage() {
  const router = useRouter();
  const [records, setRecords] = useState<MyAMC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/amc/my", { credentials: "include" });
      if (res.status === 401) { router.push("/auth/login"); return; }
      if (!res.ok) { setError("Failed to load records."); return; }
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const tabCounts = Object.fromEntries(
    TAB_CONFIG.map((t) => [t.key, filterByTab(records, t.key).length])
  ) as Record<Tab, number>;

  const visible = filterByTab(records, activeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" data-testid="page-title">My AMC</h1>
          <p className="text-sm text-slate-500 mt-0.5">AMC records assigned to you</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 bg-slate-50">
          {TAB_CONFIG.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              data-testid={`tab-${t.key}`}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === t.key
                  ? "border-blue-600 text-blue-600 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.icon}
              {t.label}
              <span
                className={`ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-xs font-bold ${
                  activeTab === t.key
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {tabCounts[t.key]}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-slate-50 rounded-full mb-4">
              <Wrench size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-600 font-medium">No AMC assigned</p>
            <p className="text-slate-400 text-sm mt-1">
              No records in this category right now.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Due Date</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Level</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 transition-colors"
                    data-testid={`row-my-amc-${r.id}`}
                  >
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {r.name || <span className="italic text-slate-400">Untitled</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {r.due_date ? fmtDate(r.due_date) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">{r.current_level}</td>
                    <td className="px-5 py-4">
                      <ActionCell record={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

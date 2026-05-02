"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck, Wrench, AlertTriangle, ArrowRight, RefreshCw,
  Inbox, CheckCircle2, Clock, Layers,
} from "lucide-react";

type SummaryRecord = {
  id: string;
  module: "COMPLIANCE" | "AMC";
  name: string;
  template_name: string | null;
  due_date: string | null;
  is_overdue: boolean;
  current_level: number;
  total_levels: number;
  is_assigned: boolean;
};

type Totals = {
  compliance_assigned: number;
  amc_assigned: number;
  compliance_all: number;
  amc_all: number;
};

export default function ApprovalsHubPage() {
  const [compliance, setCompliance] = useState<SummaryRecord[]>([]);
  const [amc, setAmc] = useState<SummaryRecord[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/approvals/pending")
      .then((r) => r.json())
      .then((d) => {
        setCompliance(Array.isArray(d.compliance) ? d.compliance : []);
        setAmc(Array.isArray(d.amc) ? d.amc : []);
        setTotals(d.totals ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const myTotal = (totals?.compliance_assigned ?? 0) + (totals?.amc_assigned ?? 0);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Approvals Hub</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            All pending approvals across Compliance and AMC modules
          </p>
        </div>
        <button
          onClick={load}
          data-testid="btn-refresh-hub"
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<ShieldCheck size={18} className="text-violet-600" />}
          label="My Compliance"
          value={totals?.compliance_assigned ?? 0}
          bg="bg-violet-50"
          loading={loading}
        />
        <StatCard
          icon={<Wrench size={18} className="text-amber-600" />}
          label="My AMC"
          value={totals?.amc_assigned ?? 0}
          bg="bg-amber-50"
          loading={loading}
        />
        <StatCard
          icon={<CheckCircle2 size={18} className="text-slate-500" />}
          label="All Compliance"
          value={totals?.compliance_all ?? 0}
          bg="bg-slate-50"
          loading={loading}
        />
        <StatCard
          icon={<Layers size={18} className="text-slate-500" />}
          label="All AMC"
          value={totals?.amc_all ?? 0}
          bg="bg-slate-50"
          loading={loading}
        />
      </div>

      {/* Module sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ModulePanel
          title="Compliance"
          icon={<ShieldCheck size={16} className="text-violet-600" />}
          records={compliance}
          href="/compliance/pending-approval"
          loading={loading}
          accentClass="border-violet-200 bg-violet-50 text-violet-700"
        />
        <ModulePanel
          title="AMC"
          icon={<Wrench size={16} className="text-amber-600" />}
          records={amc}
          href="/amc/pending-approval"
          loading={loading}
          accentClass="border-amber-200 bg-amber-50 text-amber-700"
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
  loading: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 px-5 py-4 rounded-xl border border-slate-200 bg-white shadow-sm`}>
      <div className={`p-2.5 rounded-lg ${bg}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        {loading ? (
          <div className="h-6 w-8 bg-slate-200 rounded animate-pulse mt-0.5" />
        ) : (
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        )}
      </div>
    </div>
  );
}

function ModulePanel({
  title,
  icon,
  records,
  href,
  loading,
  accentClass,
}: {
  title: string;
  icon: React.ReactNode;
  records: SummaryRecord[];
  href: string;
  loading: boolean;
  accentClass: string;
}) {
  const assigned = records.filter((r) => r.is_assigned);
  const overdue = records.filter((r) => r.is_overdue);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold text-slate-900">{title} Pending</h2>
          {assigned.length > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${accentClass}`}>
              {assigned.length} assigned
            </span>
          )}
        </div>
        <Link
          href={href}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          data-testid={`link-goto-${title.toLowerCase()}`}
        >
          View all
          <ArrowRight size={12} />
        </Link>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <Inbox size={32} className="mb-2 opacity-40" />
          <p className="text-xs">No pending {title} records</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {records.slice(0, 6).map((r) => (
            <div key={r.id} className="flex items-center justify-between px-5 py-3 gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 truncate font-medium">{r.name}</p>
                {r.template_name && (
                  <p className="text-xs text-slate-400 truncate">{r.template_name}</p>
                )}
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Layers size={10} />
                    L{r.current_level}/{r.total_levels}
                  </span>
                  {r.due_date && (
                    <span className={`flex items-center gap-1 ${r.is_overdue ? "text-red-600 font-medium" : ""}`}>
                      <Clock size={10} />
                      {new Date(r.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.is_overdue && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                    <AlertTriangle size={9} />
                    OD
                  </span>
                )}
                {r.is_assigned ? (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${accentClass}`}>
                    Mine
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    View
                  </span>
                )}
              </div>
            </div>
          ))}
          {records.length > 6 && (
            <div className="px-5 py-3 text-center">
              <Link href={href} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                +{records.length - 6} more — view all
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, Wrench, Clock, Send, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface ModuleStats {
  pending:   number;
  submitted: number;
  approved:  number;
  rejected:  number;
  overdue:   number;
}

interface DashboardData {
  compliance: ModuleStats;
  amc:        ModuleStats;
}

/* ─── Stat card ─────────────────────────────────────────────────────────── */

function StatCard({
  label, value, icon: Icon, colorCls, href,
}: {
  label:    string;
  value:    number;
  icon:     React.ElementType;
  colorCls: string;
  href:     string;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href)}
      className={`group flex flex-col gap-3 p-5 rounded-2xl border transition-all text-left w-full hover:shadow-md active:scale-[0.98] ${colorCls}`}
      data-testid={`card-${label.toLowerCase().replace(/\s+/, "-")}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</span>
        <Icon size={18} className="opacity-60" />
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </button>
  );
}

/* ─── Section ────────────────────────────────────────────────────────────── */

function ModuleSection({
  title, icon: Icon, stats, basePath,
}: {
  title:    string;
  icon:     React.ElementType;
  stats:    ModuleStats;
  basePath: string;
}) {
  const cards = [
    { label: "Pending",   value: stats.pending,   icon: Clock,         colorCls: "bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300",           href: `${basePath}?status=Pending`   },
    { label: "Submitted", value: stats.submitted, icon: Send,          colorCls: "bg-yellow-50 border-yellow-200 text-yellow-800 hover:border-yellow-300",        href: `${basePath}?status=Submitted` },
    { label: "Approved",  value: stats.approved,  icon: CheckCircle2,  colorCls: "bg-green-50 border-green-200 text-green-800 hover:border-green-300",            href: `${basePath}?status=Approved`  },
    { label: "Rejected",  value: stats.rejected,  icon: XCircle,       colorCls: "bg-red-50 border-red-200 text-red-800 hover:border-red-300",                    href: `${basePath}?status=Rejected`  },
    { label: "Overdue",   value: stats.overdue,   icon: AlertTriangle, colorCls: "bg-orange-50 border-orange-200 text-orange-800 hover:border-orange-300",        href: `${basePath}?status=Overdue`   },
  ];

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white">
          <Icon size={16} />
        </div>
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

const ROLE_LABEL: Record<string, string> = {
  USER:        "User",
  APPROVER:    "Approver",
  MANAGER:     "Manager",
  ADMIN:       "Admin",
  SUPER_ADMIN: "Super Admin",
  CEO:         "CEO",
  CHECKER:     "Checker",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  function fetchData() {
    setLoading(true);
    setError("");
    fetch("/api/dashboard", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => { setError("Network error."); setLoading(false); });
  }

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Overview for
            {user?.email ? ` ${user.email}` : ""}
            {user?.role ? (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            ) : null}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          data-testid="btn-refresh"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-8">
          {[1, 2].map((s) => (
            <div key={s}>
              <div className="h-5 w-32 bg-slate-100 rounded-lg animate-pulse mb-4" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sections */}
      {!loading && data && (
        <div className="space-y-8">
          <ModuleSection
            title="Compliance"
            icon={ShieldCheck}
            stats={data.compliance}
            basePath="/compliance"
          />
          <div className="border-t border-slate-100" />
          <ModuleSection
            title="AMC"
            icon={Wrench}
            stats={data.amc}
            basePath="/amc"
          />
        </div>
      )}
    </div>
  );
}

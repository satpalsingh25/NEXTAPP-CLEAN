"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, ScrollText } from "lucide-react";

const MODULES = ["DMS", "COMPLIANCE", "AMC", "ADMIN", "SYSTEM"];
const ACTIONS = [
  "CREATE_FOLDER",
  "DELETE_FOLDER",
  "UPLOAD_FILE",
  "DOWNLOAD_FILE",
  "DELETE_FILE",
  "RENAME",
  "PERMISSION_UPDATE",
  "UPDATE_BRANDING",
  "USER_CREATE",
  "USER_UPDATE",
];

interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  module: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  created_at: string;
}

interface ApiResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export default function AuditLogsPage() {
  const [module, setModule]     = useState("");
  const [action, setAction]     = useState("");
  const [from, setFrom]         = useState("");
  const [to, setTo]             = useState("");
  const [page, setPage]         = useState(1);
  const [data, setData]         = useState<ApiResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const fetchLogs = useCallback(async (p = page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page",  String(p));
      params.set("limit", "20");
      if (module) params.set("module", module);
      if (action) params.set("action", action);
      if (from)   params.set("from",   from);
      if (to)     params.set("to",     to);

      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) throw new Error("Failed to load audit logs.");
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [module, action, from, to, page]);

  useEffect(() => { fetchLogs(1); setPage(1); }, []);  // initial load

  function handleSearch() {
    setPage(1);
    fetchLogs(1);
  }

  function handlePrev() {
    const p = Math.max(1, page - 1);
    setPage(p);
    fetchLogs(p);
  }

  function handleNext() {
    if (!data || page >= data.pages) return;
    const p = page + 1;
    setPage(p);
    fetchLogs(p);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      day:    "2-digit",
      month:  "short",
      year:   "numeric",
      hour:   "2-digit",
      minute: "2-digit",
    });
  }

  const moduleBadge: Record<string, string> = {
    DMS:        "bg-blue-100   text-blue-800   dark:bg-blue-900/40   dark:text-blue-300",
    COMPLIANCE: "bg-green-100  text-green-800  dark:bg-green-900/40  dark:text-green-300",
    AMC:        "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    ADMIN:      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    SYSTEM:     "bg-gray-100   text-gray-700   dark:bg-gray-800      dark:text-gray-300",
  };

  const actionBadge: Record<string, string> = {
    CREATE_FOLDER:      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    DELETE_FOLDER:      "bg-red-100     text-red-800     dark:bg-red-900/40     dark:text-red-300",
    UPLOAD_FILE:        "bg-sky-100     text-sky-800     dark:bg-sky-900/40     dark:text-sky-300",
    DOWNLOAD_FILE:      "bg-indigo-100  text-indigo-800  dark:bg-indigo-900/40  dark:text-indigo-300",
    DELETE_FILE:        "bg-red-100     text-red-800     dark:bg-red-900/40     dark:text-red-300",
    RENAME:             "bg-yellow-100  text-yellow-800  dark:bg-yellow-900/40  dark:text-yellow-300",
    PERMISSION_UPDATE:  "bg-violet-100  text-violet-800  dark:bg-violet-900/40  dark:text-violet-300",
    UPDATE_BRANDING:    "bg-pink-100    text-pink-800    dark:bg-pink-900/40    dark:text-pink-300",
    USER_CREATE:        "bg-teal-100    text-teal-800    dark:bg-teal-900/40    dark:text-teal-300",
    USER_UPDATE:        "bg-amber-100   text-amber-800   dark:bg-amber-900/40   dark:text-amber-300",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <ScrollText size={22} className="text-slate-500" />
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Audit Logs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track key actions across modules</p>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 min-w-[150px]">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Module</label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All modules</option>
              {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All actions</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Search size={15} />
            Search
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">Loading…</div>
        ) : !data || data.logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <ScrollText size={36} className="opacity-30" />
            <span className="text-sm">No activity found</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Module</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Action</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {data.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {log.user_name ?? <span className="text-slate-400 italic text-xs">system</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${moduleBadge[log.module] ?? "bg-gray-100 text-gray-700"}`}>
                        {log.module}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionBadge[log.action] ?? "bg-gray-100 text-gray-700"}`}>
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={log.description ?? ""}>
                      {log.description ?? <span className="text-slate-400 italic text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>
            Showing {((page - 1) * data.limit) + 1}–{Math.min(page * data.limit, data.total)} of {data.total} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={page <= 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <span className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              Page {page} of {data.pages}
            </span>
            <button
              onClick={handleNext}
              disabled={page >= data.pages || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

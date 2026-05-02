"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Search, UserPlus, X, Pencil, KeyRound, PowerOff, Power,
  Trash2, ClipboardList, ChevronDown, AlertTriangle, Eye, EyeOff,
  ShieldCheck, Info,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RefItem { id: string; name: string }
interface DeptItem extends RefItem { company_id?: string | null; company?: RefItem | null }
interface FuncItem extends RefItem { department_id?: string | null; company_id?: string | null; department?: RefItem | null; company?: RefItem | null }
interface GroupItem extends RefItem { company_id?: string | null }

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  must_reset_password: boolean;
  created_at: string;
  company: RefItem | null;
  department: RefItem | null;
  businessFunction: RefItem | null;
  group: RefItem | null;
}

interface AuditEntry {
  id: string;
  action_type: string;
  module: string;
  record_id: string;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  timestamp: string;
}

interface UserDetail extends User {
  audit_logs: AuditEntry[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = ["USER", "APPROVER", "CHECKER", "MANAGER", "ADMIN", "CEO", "SUPER_ADMIN"];

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: "bg-violet-100 text-violet-700 border-violet-200",
  ADMIN:       "bg-blue-100 text-blue-700 border-blue-200",
  MANAGER:     "bg-indigo-100 text-indigo-700 border-indigo-200",
  CHECKER:     "bg-cyan-100 text-cyan-700 border-cyan-200",
  APPROVER:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  USER:        "bg-slate-100 text-slate-600 border-slate-200",
  CEO:         "bg-amber-100 text-amber-700 border-amber-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const api = (url: string, opts?: RequestInit) => fetch(url, opts);

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel, loading }: {
  title: string; message: string; confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex gap-3 mb-4">
          <div className={`p-2 rounded-lg ${danger ? "bg-red-50" : "bg-amber-50"}`}>
            <AlertTriangle size={18} className={danger ? "text-red-500" : "text-amber-500"} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-amber-500 hover:bg-amber-600"}`}
          >
            {loading ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Action Menu ──────────────────────────────────────────────────────────────

function ActionMenu({ user, onAction }: {
  user: User;
  onAction: (action: string, user: User) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid={`btn-actions-${user.id}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
      >
        Actions <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 text-sm">
            <button
              onClick={() => { setOpen(false); onAction("edit", user); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition-colors"
              data-testid={`btn-edit-${user.id}`}
            >
              <Pencil size={14} className="text-blue-500" /> Edit User
            </button>
            <button
              onClick={() => { setOpen(false); onAction("reset-password", user); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition-colors"
              data-testid={`btn-reset-${user.id}`}
            >
              <KeyRound size={14} className="text-amber-500" /> Reset Password
            </button>
            <div className="border-t border-slate-100 my-1" />
            {user.is_active ? (
              <button
                onClick={() => { setOpen(false); onAction("disable", user); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition-colors"
                data-testid={`btn-disable-${user.id}`}
              >
                <PowerOff size={14} className="text-orange-500" /> Disable User
              </button>
            ) : (
              <button
                onClick={() => { setOpen(false); onAction("enable", user); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition-colors"
                data-testid={`btn-enable-${user.id}`}
              >
                <Power size={14} className="text-green-500" /> Enable User
              </button>
            )}
            <button
              onClick={() => { setOpen(false); onAction("audit", user); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition-colors"
              data-testid={`btn-audit-${user.id}`}
            >
              <ClipboardList size={14} className="text-slate-500" /> Audit Details
            </button>
            <div className="border-t border-slate-100 my-1" />
            <button
              onClick={() => { setOpen(false); onAction("delete", user); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors"
              data-testid={`btn-delete-${user.id}`}
            >
              <Trash2 size={14} /> Delete User
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<RefItem[]>([]);
  const [departments, setDepartments] = useState<DeptItem[]>([]);
  const [functions, setFunctions] = useState<FuncItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Modals
  const [showCreate, setShowCreate]   = useState(false);
  const [editUser, setEditUser]       = useState<User | null>(null);
  const [resetUser, setResetUser]     = useState<User | null>(null);
  const [auditUser, setAuditUser]     = useState<UserDetail | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; user: User } | null>(null);

  // Create form state
  const [cEmail, setCEmail]         = useState("");
  const [cName, setCName]           = useState("");
  const [cPassword, setCPassword]   = useState("");
  const [cRole, setCRole]           = useState("USER");
  const [cCompany, setCCompany]     = useState("");
  const [cDept, setCDept]           = useState("");
  const [cFunc, setCFunc]           = useState("");
  const [cGroup, setCGroup]         = useState("");
  const [cForceReset, setCForceReset] = useState(true);
  const [cSaving, setCsaving]       = useState(false);
  const [cError, setCError]         = useState("");

  // Edit form state
  const [eName, setEName]         = useState("");
  const [eEmail, setEEmail]       = useState("");
  const [eRole, setERole]         = useState("");
  const [eCompany, setECompany]   = useState("");
  const [eDept, setEDept]         = useState("");
  const [eFunc, setEFunc]         = useState("");
  const [eGroup, setEGroup]       = useState("");
  const [eSaving, setEsaving]     = useState(false);
  const [eError, setEError]       = useState("");

  // Reset password state
  const [rPassword, setRPassword]   = useState("");
  const [rShowPw, setRShowPw]       = useState(false);
  const [rForce, setRForce]         = useState(true);
  const [rSaving, setRSaving]       = useState(false);
  const [rError, setRError]         = useState("");

  const [actionLoading, setActionLoading] = useState(false);

  const loadUsers = useCallback(() => {
    setLoading(true);
    api("/api/admin/users")
      .then((r) => r.json())
      .then((data) => { setUsers(Array.isArray(data) ? data : []); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadUsers();
    api("/api/admin/companies").then((r) => r.json()).then(setCompanies);
    api("/api/admin/departments").then((r) => r.json()).then(setDepartments);
    api("/api/admin/functions").then((r) => r.json()).then(setFunctions);
    api("/api/admin/groups").then((r) => r.json()).then(setGroups);
  }, [loadUsers]);

  const filtered = useMemo(() => users.filter((u) => {
    if (search      && !u.email.toLowerCase().includes(search.toLowerCase()) && !(u.name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole    && u.role !== filterRole) return false;
    if (filterCompany && u.company?.id !== filterCompany) return false;
    if (filterStatus  === "active"   && !u.is_active) return false;
    if (filterStatus  === "inactive" && u.is_active)  return false;
    if (filterStatus  === "pending"  && !u.must_reset_password) return false;
    return true;
  }), [users, search, filterRole, filterCompany, filterStatus]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleAction = useCallback((action: string, user: User) => {
    if (action === "edit") {
      setEName(user.name ?? "");
      setEEmail(user.email);
      setERole(user.role);
      setECompany(user.company?.id ?? "");
      setEDept(user.department?.id ?? "");
      setEFunc(user.businessFunction?.id ?? "");
      setEGroup(user.group?.id ?? "");
      setEError(""); setEsaving(false);
      setEditUser(user);
    } else if (action === "reset-password") {
      setRPassword(""); setRForce(true); setRShowPw(false); setRError(""); setRSaving(false);
      setResetUser(user);
    } else if (action === "audit") {
      setAuditUser(null); setAuditLoading(true);
      api(`/api/admin/users/${user.id}`).then((r) => r.json()).then((d) => {
        setAuditUser(d); setAuditLoading(false);
      });
    } else if (action === "disable" || action === "delete") {
      setConfirmAction({ type: action, user });
    } else if (action === "enable") {
      setActionLoading(true);
      api(`/api/admin/users/${user.id}/enable`, { method: "POST" })
        .then(() => loadUsers())
        .finally(() => setActionLoading(false));
    }
  }, [loadUsers]);

  const handleCreate = async () => {
    setCError("");
    if (!cEmail || !cPassword) { setCError("Email and password are required."); return; }
    setCsaving(true);
    const res = await api("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cEmail, name: cName, password: cPassword, role: cRole,
        company_id: cCompany || undefined,
        department_id: cDept || undefined,
        function_id: cFunc || undefined,
        group_id: cGroup || undefined,
        must_reset_password: cForceReset,
      }),
    });
    setCsaving(false);
    if (!res.ok) { const d = await res.json(); setCError(d.error || "Failed to create user."); return; }
    setShowCreate(false);
    setCEmail(""); setCName(""); setCPassword(""); setCRole("USER"); setCCompany(""); setCDept(""); setCFunc(""); setCGroup("");
    loadUsers();
  };

  const handleEdit = async () => {
    setEError("");
    if (!eEmail) { setEError("Email is required."); return; }
    setEsaving(true);
    const res = await api(`/api/admin/users/${editUser!.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: eName, email: eEmail, role: eRole,
        company_id: eCompany || undefined,
        department_id: eDept,
        function_id: eFunc,
        group_id: eGroup,
      }),
    });
    setEsaving(false);
    if (!res.ok) { const d = await res.json(); setEError(d.error || "Failed to update user."); return; }
    setEditUser(null);
    loadUsers();
  };

  const handleResetPassword = async () => {
    setRError("");
    if (rPassword.length < 6) { setRError("Password must be at least 6 characters."); return; }
    setRSaving(true);
    const res = await api(`/api/admin/users/${resetUser!.id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: rPassword, force_reset: rForce }),
    });
    setRSaving(false);
    if (!res.ok) { const d = await res.json(); setRError(d.error || "Failed to reset password."); return; }
    setResetUser(null);
    loadUsers();
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { type, user } = confirmAction;
    setActionLoading(true);
    if (type === "disable") {
      await api(`/api/admin/users/${user.id}/disable`, { method: "POST" });
    } else if (type === "delete") {
      await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
    }
    setActionLoading(false);
    setConfirmAction(null);
    loadUsers();
  };

  // ─── Stats ────────────────────────────────────────────────────────────────

  const activeCount   = users.filter((u) => u.is_active).length;
  const inactiveCount = users.filter((u) => !u.is_active).length;
  const pendingReset  = users.filter((u) => u.must_reset_password).length;

  const refOpts = (list: RefItem[]) => list.map((i) => ({ value: i.id, label: i.name }));

  // Cascading options
  const cDeptOpts = cCompany
    ? departments.filter((d) => (d.company?.id ?? d.company_id) === cCompany)
    : departments;
  const cFuncOpts = cDept
    ? functions.filter((f) => (f.department?.id ?? f.department_id) === cDept)
    : cCompany
      ? functions.filter((f) => (f.company?.id ?? f.company_id) === cCompany)
      : functions;

  const eDeptOpts = eCompany
    ? departments.filter((d) => (d.company?.id ?? d.company_id) === eCompany)
    : departments;
  const eFuncOpts = eDept
    ? functions.filter((f) => (f.department?.id ?? f.department_id) === eDept)
    : eCompany
      ? functions.filter((f) => (f.company?.id ?? f.company_id) === eCompany)
      : functions;

  return (
    <div className="space-y-6 max-w-full">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">{users.length} registered user{users.length !== 1 ? "s" : ""} across all companies</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCError(""); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          data-testid="btn-create-user"
        >
          <UserPlus size={15} /> New User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Users",    value: users.length,   color: "text-slate-900" },
          { label: "Active",         value: activeCount,    color: "text-emerald-700" },
          { label: "Disabled",       value: inactiveCount,  color: "text-red-600" },
          { label: "Pending Reset",  value: pendingReset,   color: "text-amber-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            data-testid="select-filter-role"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            data-testid="select-filter-company"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            data-testid="select-filter-status"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Disabled</option>
            <option value="pending">Pending Password Reset</option>
          </select>
          {(search || filterRole || filterCompany || filterStatus) && (
            <button
              onClick={() => { setSearch(""); setFilterRole(""); setFilterCompany(""); setFilterStatus(""); }}
              className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              data-testid="btn-clear-filters"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">
            {filtered.length} user{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== users.length && <span className="font-normal text-slate-400"> (filtered)</span>}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Search size={20} className="text-slate-300" />
            <p className="text-sm text-slate-400">No users match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {["User", "Company", "Role", "Dept / Function / Group", "Status", "Created", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((u) => (
                  <tr key={u.id} className={`hover:bg-slate-50/70 transition-colors ${!u.is_active ? "opacity-60" : ""}`} data-testid={`row-user-${u.id}`}>

                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {(u.name || u.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{u.name || <span className="text-slate-400 italic">No name</span>}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                        {u.must_reset_password && (
                          <span title="Password reset required" className="ml-1 p-1 rounded bg-amber-50 text-amber-500">
                            <KeyRound size={11} />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {u.company?.name ?? <span className="text-slate-300">—</span>}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${ROLE_BADGE[u.role] ?? "bg-slate-100 text-slate-600"}`}
                        data-testid={`badge-role-${u.id}`}>
                        {u.role}
                      </span>
                    </td>

                    {/* Dept / Function / Group */}
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div className="space-y-0.5">
                        {u.department       && <div><span className="font-medium text-slate-700">Dept:</span> {u.department.name}</div>}
                        {u.businessFunction && <div><span className="font-medium text-slate-700">Fn:</span> {u.businessFunction.name}</div>}
                        {u.group            && <div><span className="font-medium text-slate-700">Grp:</span> {u.group.name}</div>}
                        {!u.department && !u.businessFunction && !u.group && <span className="text-slate-300">—</span>}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${u.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}
                        data-testid={`status-${u.id}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-red-400"}`} />
                        {u.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(u.created_at)}</td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <ActionMenu user={u} onAction={handleAction} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create User Modal ────────────────────────────────────────────────── */}
      {showCreate && (
        <Modal title="Create New User" onClose={() => setShowCreate(false)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name">
              <Input value={cName} onChange={setCName} placeholder="Jane Smith" />
            </Field>
            <Field label="Email *">
              <Input type="email" value={cEmail} onChange={setCEmail} placeholder="jane@company.com" />
            </Field>
            <Field label="Temporary Password *">
              <Input type="password" value={cPassword} onChange={setCPassword} placeholder="Min. 6 characters" />
            </Field>
            <Field label="Role">
              <Select value={cRole} onChange={setCRole} options={ROLES.map((r) => ({ value: r, label: r }))} />
            </Field>
            <Field label="Company">
              <Select value={cCompany} onChange={(v) => { setCCompany(v); setCDept(""); setCFunc(""); }} options={refOpts(companies)} placeholder="Select company" />
            </Field>
            <Field label="Department">
              <Select value={cDept} onChange={(v) => { setCDept(v); setCFunc(""); }} options={refOpts(cDeptOpts)} placeholder="None" />
            </Field>
            <Field label="Function">
              <Select value={cFunc} onChange={setCFunc} options={refOpts(cFuncOpts)} placeholder="None" />
            </Field>
            <Field label="Group">
              <Select value={cGroup} onChange={setCGroup} options={refOpts(groups)} placeholder="None" />
            </Field>
          </div>
          <label className="flex items-center gap-2.5 mt-4 cursor-pointer text-sm text-slate-700">
            <input
              type="checkbox"
              checked={cForceReset}
              onChange={(e) => setCForceReset(e.target.checked)}
              className="rounded border-slate-300"
              data-testid="check-force-reset-create"
            />
            <span>Force password reset on first login</span>
          </label>
          {cError && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <Info size={14} /> {cError}
            </div>
          )}
          <div className="mt-5 flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={cSaving}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              data-testid="btn-submit-create"
            >
              {cSaving ? "Creating…" : "Create User"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit User Modal ──────────────────────────────────────────────────── */}
      {editUser && (
        <Modal title={`Edit User — ${editUser.email}`} onClose={() => setEditUser(null)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name">
              <Input value={eName} onChange={setEName} placeholder="Jane Smith" />
            </Field>
            <Field label="Email *">
              <Input type="email" value={eEmail} onChange={setEEmail} />
            </Field>
            <Field label="Role">
              <Select value={eRole} onChange={setERole} options={ROLES.map((r) => ({ value: r, label: r }))} />
            </Field>
            <Field label="Company">
              <Select value={eCompany} onChange={(v) => { setECompany(v); setEDept(""); setEFunc(""); }} options={refOpts(companies)} placeholder="Select company" />
            </Field>
            <Field label="Department">
              <Select value={eDept} onChange={(v) => { setEDept(v); setEFunc(""); }} options={refOpts(eDeptOpts)} placeholder="None" />
            </Field>
            <Field label="Function">
              <Select value={eFunc} onChange={setEFunc} options={refOpts(eFuncOpts)} placeholder="None" />
            </Field>
            <Field label="Group">
              <Select value={eGroup} onChange={setEGroup} options={refOpts(groups)} placeholder="None" />
            </Field>
          </div>
          {eError && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <Info size={14} /> {eError}
            </div>
          )}
          <div className="mt-5 flex gap-2 justify-end">
            <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={eSaving}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              data-testid="btn-submit-edit"
            >
              {eSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Reset Password Modal ─────────────────────────────────────────────── */}
      {resetUser && (
        <Modal title={`Reset Password — ${resetUser.email}`} onClose={() => setResetUser(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <ShieldCheck size={16} className="mt-0.5 flex-shrink-0" />
              <span>You are setting a temporary password for this user. Share it securely.</span>
            </div>
            <Field label="New Temporary Password">
              <div className="relative">
                <input
                  type={rShowPw ? "text" : "password"}
                  value={rPassword}
                  onChange={(e) => setRPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  data-testid="input-new-password"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setRShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {rShowPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
            <label className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                checked={rForce}
                onChange={(e) => setRForce(e.target.checked)}
                className="rounded border-slate-300"
                data-testid="check-force-reset"
              />
              <span>Force password reset on next login</span>
            </label>
            {rError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <Info size={14} /> {rError}
              </div>
            )}
          </div>
          <div className="mt-5 flex gap-2 justify-end">
            <button onClick={() => setResetUser(null)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleResetPassword}
              disabled={rSaving}
              className="px-5 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
              data-testid="btn-submit-reset"
            >
              {rSaving ? "Resetting…" : "Reset Password"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Audit Details Modal ──────────────────────────────────────────────── */}
      {(auditUser || auditLoading) && (
        <Modal title={auditUser ? `Audit Trail — ${auditUser.email}` : "Loading Audit…"} onClose={() => { setAuditUser(null); setAuditLoading(false); }} wide>
          {auditLoading && <p className="text-sm text-slate-400 text-center py-8">Loading audit logs…</p>}
          {auditUser && (
            <>
              {/* User summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Role",    value: auditUser.role },
                  { label: "Company", value: auditUser.company?.name ?? "—" },
                  { label: "Status",  value: auditUser.is_active ? "Active" : "Disabled" },
                  { label: "Joined",  value: fmtDate(auditUser.created_at) },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-50 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{s.label}</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Audit log */}
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Activity Log ({auditUser.audit_logs.length} entries)</h3>
              {auditUser.audit_logs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No audit entries recorded.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {auditUser.audit_logs.map((log) => (
                    <div key={log.id} className="flex gap-3 p-3 bg-slate-50 rounded-xl text-xs">
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                        <ClipboardList size={13} className="text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800">{log.action_type}</span>
                          <span className="text-slate-400 whitespace-nowrap">{fmtDate(log.timestamp)}</span>
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          Module: <span className="font-medium">{log.module}</span>
                          {log.ip_address && <> · IP: <span className="font-medium">{log.ip_address}</span></>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Modal>
      )}

      {/* ── Confirm Actions ──────────────────────────────────────────────────── */}
      {confirmAction?.type === "disable" && (
        <ConfirmDialog
          title="Disable User"
          message={`Disable "${confirmAction.user.email}"? They will no longer be able to log in.`}
          confirmLabel="Disable"
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
          loading={actionLoading}
        />
      )}
      {confirmAction?.type === "delete" && (
        <ConfirmDialog
          title="Delete User"
          message={`Permanently delete "${confirmAction.user.email}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}

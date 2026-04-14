"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Plus, X, Pencil, Trash2, Search, Info,
  ChevronRight, Building2, UserCircle, LayoutList,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RefItem { id: string; name: string }

interface Group {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  company: RefItem | null;
  owner: { id: string; name: string | null; email: string } | null;
  department: RefItem | null;
  businessFunction: RefItem | null;
  _count: { users: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const api = (url: string, opts?: RequestInit) => fetch(url, opts);
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function FInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

function FSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Group Form (shared by Create + Edit) ─────────────────────────────────────

interface GroupFormProps {
  name: string; setName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  companyId: string; setCompanyId: (v: string) => void;
  ownerId: string; setOwnerId: (v: string) => void;
  deptId: string; setDeptId: (v: string) => void;
  funcId: string; setFuncId: (v: string) => void;
  companies: RefItem[]; users: { id: string; name: string | null; email: string }[];
  departments: RefItem[]; functions: RefItem[];
  error: string; saving: boolean;
  submitLabel: string; onSubmit: () => void; onCancel: () => void;
}

function GroupForm(p: GroupFormProps) {
  const userOpts = p.users.map((u) => ({ value: u.id, label: u.name ? `${u.name} (${u.email})` : u.email }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Group Name *">
          <FInput value={p.name} onChange={p.setName} placeholder="e.g. Finance Team" />
        </Field>
        <Field label="Company">
          <FSelect value={p.companyId} onChange={p.setCompanyId}
            options={p.companies.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select company" />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          value={p.description} onChange={(e) => p.setDescription(e.target.value)}
          placeholder="Optional group description…"
          rows={2}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Group Owner">
          <FSelect value={p.ownerId} onChange={p.setOwnerId} options={userOpts} placeholder="No owner" />
        </Field>
        <Field label="Department">
          <FSelect value={p.deptId} onChange={p.setDeptId}
            options={p.departments.map((d) => ({ value: d.id, label: d.name }))} placeholder="None" />
        </Field>
        <Field label="Function">
          <FSelect value={p.funcId} onChange={p.setFuncId}
            options={p.functions.map((f) => ({ value: f.id, label: f.name }))} placeholder="None" />
        </Field>
      </div>

      {p.error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <Info size={14} /> {p.error}
        </div>
      )}
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={p.onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
          Cancel
        </button>
        <button onClick={p.onSubmit} disabled={p.saving || !p.name.trim()}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          data-testid="btn-submit-group">
          {p.saving ? "Saving…" : p.submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Confirm Delete ───────────────────────────────────────────────────────────

function ConfirmDelete({ group, onConfirm, onCancel, loading }: {
  group: Group; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex gap-3 mb-4">
          <div className="p-2 rounded-lg bg-red-50"><Trash2 size={18} className="text-red-500" /></div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Delete Group</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Delete &quot;{group.name}&quot;? Members will be unassigned. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
            data-testid="btn-confirm-delete">
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GroupsPage() {
  const router = useRouter();

  const [groups, setGroups]   = useState<Group[]>([]);
  const [companies, setCompanies] = useState<RefItem[]>([]);
  const [users, setUsers]     = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [depts, setDepts]     = useState<RefItem[]>([]);
  const [funcs, setFuncs]     = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [cName, setCName]   = useState("");
  const [cDesc, setCDesc]   = useState("");
  const [cCo, setCCo]       = useState("");
  const [cOwner, setCOwner] = useState("");
  const [cDept, setCDept]   = useState("");
  const [cFunc, setCFunc]   = useState("");
  const [cErr, setCErr]     = useState("");
  const [cSaving, setCSaving] = useState(false);

  // Edit state
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [eName, setEName]   = useState("");
  const [eDesc, setEDesc]   = useState("");
  const [eCo, setECo]       = useState("");
  const [eOwner, setEOwner] = useState("");
  const [eDept, setEDept]   = useState("");
  const [eFunc, setEFunc]   = useState("");
  const [eErr, setEErr]     = useState("");
  const [eSaving, setESaving] = useState(false);

  // Delete state
  const [deleteGroup, setDeleteGroup] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadGroups = useCallback(() => {
    setLoading(true);
    api("/api/admin/groups").then((r) => r.json())
      .then((d) => setGroups(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadGroups();
    api("/api/admin/companies").then((r) => r.json()).then(setCompanies);
    api("/api/admin/users").then((r) => r.json()).then(setUsers);
    api("/api/admin/departments").then((r) => r.json()).then(setDepts);
    api("/api/admin/functions").then((r) => r.json()).then(setFuncs);
  }, [loadGroups]);

  const filtered = useMemo(() =>
    groups.filter((g) => !search || g.name.toLowerCase().includes(search.toLowerCase()) ||
      (g.description ?? "").toLowerCase().includes(search.toLowerCase())),
    [groups, search]);

  const totalMembers = groups.reduce((s, g) => s + g._count.users, 0);

  // ─── Create ────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    setCErr("");
    if (!cName.trim()) { setCErr("Name is required."); return; }
    setCSaving(true);
    const res = await api("/api/admin/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cName, description: cDesc, company_id: cCo, owner_id: cOwner, department_id: cDept, function_id: cFunc }),
    });
    setCSaving(false);
    if (!res.ok) { const d = await res.json(); setCErr(d.error || "Failed to create."); return; }
    setShowCreate(false); setCName(""); setCDesc(""); setCCo(""); setCOwner(""); setCDept(""); setCFunc("");
    loadGroups();
  };

  // ─── Edit ──────────────────────────────────────────────────────────────────

  const openEdit = (g: Group) => {
    setEName(g.name); setEDesc(g.description ?? ""); setECo(g.company?.id ?? "");
    setEOwner(g.owner?.id ?? ""); setEDept(g.department?.id ?? ""); setEFunc(g.businessFunction?.id ?? "");
    setEErr(""); setESaving(false); setEditGroup(g);
  };

  const handleEdit = async () => {
    setEErr("");
    if (!eName.trim()) { setEErr("Name is required."); return; }
    setESaving(true);
    const res = await api(`/api/admin/groups/${editGroup!.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: eName, description: eDesc, company_id: eCo, owner_id: eOwner, department_id: eDept, function_id: eFunc }),
    });
    setESaving(false);
    if (!res.ok) { const d = await res.json(); setEErr(d.error || "Failed to update."); return; }
    setEditGroup(null);
    loadGroups();
  };

  // ─── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteGroup) return;
    setDeleting(true);
    await api(`/api/admin/groups/${deleteGroup.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteGroup(null);
    loadGroups();
  };

  const formProps = (mode: "create" | "edit") => mode === "create"
    ? { name: cName, setName: setCName, description: cDesc, setDescription: setCDesc, companyId: cCo, setCompanyId: setCCo, ownerId: cOwner, setOwnerId: setCOwner, deptId: cDept, setDeptId: setCDept, funcId: cFunc, setFuncId: setCFunc, error: cErr, saving: cSaving, submitLabel: "Create Group", onSubmit: handleCreate, onCancel: () => setShowCreate(false) }
    : { name: eName, setName: setEName, description: eDesc, setDescription: setEDesc, companyId: eCo, setCompanyId: setECo, ownerId: eOwner, setOwnerId: setEOwner, deptId: eDept, setDeptId: setEDept, funcId: eFunc, setFuncId: setEFunc, error: eErr, saving: eSaving, submitLabel: "Save Changes", onSubmit: handleEdit, onCancel: () => setEditGroup(null) };

  return (
    <div className="space-y-6 max-w-full">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Groups</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage user groups, owners, and org mappings</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCErr(""); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          data-testid="btn-new-group">
          <Plus size={15} /> New Group
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Groups",  value: groups.length,  icon: <LayoutList size={16} className="text-blue-500" /> },
          { label: "Total Members", value: totalMembers,   icon: <Users size={16} className="text-emerald-500" /> },
          { label: "Companies",     value: new Set(groups.map((g) => g.company?.id).filter(Boolean)).size, icon: <Building2 size={16} className="text-violet-500" /> },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-lg">{s.icon}</div>
            <div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" placeholder="Search groups…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-groups"
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-700">
            {filtered.length} group{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== groups.length && <span className="font-normal text-slate-400"> (filtered)</span>}
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-12">Loading groups…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14">
            <Users size={24} className="text-slate-200" />
            <p className="text-sm text-slate-400">{search ? "No groups match your search." : "No groups yet. Create one above."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {["Group", "Company", "Owner", "Dept / Function", "Members", "Created", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/60 transition-colors" data-testid={`row-group-${g.id}`}>
                    {/* Group */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {g.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{g.name}</p>
                          {g.description && <p className="text-xs text-slate-400 max-w-[180px] truncate">{g.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{g.company?.name ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {g.owner ? (
                        <div className="flex items-center gap-1.5">
                          <UserCircle size={14} className="text-slate-400 flex-shrink-0" />
                          <span>{g.owner.name || g.owner.email}</span>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {g.department && <div><span className="font-medium text-slate-700">Dept:</span> {g.department.name}</div>}
                      {g.businessFunction && <div><span className="font-medium text-slate-700">Fn:</span> {g.businessFunction.name}</div>}
                      {!g.department && !g.businessFunction && <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold rounded-full">
                        <Users size={11} /> {g._count.users}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(g.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => router.push(`/admin/groups/${g.id}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                          data-testid={`btn-view-${g.id}`}>
                          Members <ChevronRight size={11} />
                        </button>
                        <button
                          onClick={() => openEdit(g)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          data-testid={`btn-edit-${g.id}`} title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteGroup(g)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          data-testid={`btn-delete-${g.id}`} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Create Group" onClose={() => setShowCreate(false)}>
          <GroupForm
            {...formProps("create")}
            companies={companies} users={users} departments={depts} functions={funcs}
          />
        </Modal>
      )}

      {/* Edit Modal */}
      {editGroup && (
        <Modal title={`Edit Group — ${editGroup.name}`} onClose={() => setEditGroup(null)}>
          <GroupForm
            {...formProps("edit")}
            companies={companies} users={users} departments={depts} functions={funcs}
          />
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteGroup && (
        <ConfirmDelete group={deleteGroup} onConfirm={handleDelete} onCancel={() => setDeleteGroup(null)} loading={deleting} />
      )}
    </div>
  );
}

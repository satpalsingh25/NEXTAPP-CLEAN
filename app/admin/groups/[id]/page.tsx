"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Users, UserPlus, Trash2, Pencil, Building2,
  UserCircle, Layers, Briefcase, Info, X, Search, Check,
  Crown, ShieldCheck,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RefItem { id: string; name: string }

interface Member {
  id: string;
  name: string | null;
  email: string;
  role: string;
  is_active: boolean;
}

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  company: RefItem | null;
  owner: { id: string; name: string | null; email: string; role: string } | null;
  department: RefItem | null;
  businessFunction: RefItem | null;
  users: Member[];
}

interface AllUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  group: RefItem | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: "bg-violet-100 text-violet-700",
  ADMIN:       "bg-blue-100 text-blue-700",
  MANAGER:     "bg-indigo-100 text-indigo-700",
  CHECKER:     "bg-cyan-100 text-cyan-700",
  APPROVER:    "bg-emerald-100 text-emerald-700",
  USER:        "bg-slate-100 text-slate-600",
  CEO:         "bg-amber-100 text-amber-700",
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  group: GroupDetail;
  companies: RefItem[];
  allUsers: AllUser[];
  departments: RefItem[];
  functions: RefItem[];
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ group, companies, allUsers, departments, functions, onClose, onSaved }: EditModalProps) {
  const [name, setName]   = useState(group.name);
  const [desc, setDesc]   = useState(group.description ?? "");
  const [coId, setCoId]   = useState(group.company?.id ?? "");
  const [ownerId, setOwnerId] = useState(group.owner?.id ?? "");
  const [deptId, setDeptId]  = useState(group.department?.id ?? "");
  const [funcId, setFuncId]  = useState(group.businessFunction?.id ?? "");
  const [saving, setSaving]  = useState(false);
  const [err, setErr]        = useState("");

  const userOpts = allUsers.map((u) => ({ value: u.id, label: u.name ? `${u.name} (${u.email})` : u.email }));

  const save = async () => {
    if (!name.trim()) { setErr("Name is required."); return; }
    setSaving(true);
    const res = await fetch(`/api/admin/groups/${group.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: desc, company_id: coId, owner_id: ownerId, department_id: deptId, function_id: funcId }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setErr(d.error || "Failed to save."); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Edit Group</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Group Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Company</label>
              <select value={coId} onChange={(e) => setCoId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">None</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Group Owner</label>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">No owner</option>
                {userOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">None</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Function</label>
              <select value={funcId} onChange={(e) => setFuncId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">None</option>
                {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>
          {err && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <Info size={14} /> {err}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            data-testid="btn-save-edit">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Member Panel ─────────────────────────────────────────────────────────

function AddMemberPanel({ groupId, members, allUsers, onAdded }: {
  groupId: string; members: Member[]; allUsers: AllUser[]; onAdded: () => void;
}) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const memberIds = new Set(members.map((m) => m.id));

  const available = allUsers.filter((u) =>
    !memberIds.has(u.id) &&
    (!search || u.email.toLowerCase().includes(search.toLowerCase()) || (u.name ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  const addMember = async (userId: string) => {
    setAdding(userId);
    await fetch(`/api/admin/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    setAdding(null);
    setSearch("");
    onAdded();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
        <UserPlus size={15} className="text-blue-500" /> Add Members
      </h3>
      <div className="relative mb-3">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users to add…"
          data-testid="input-search-members"
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {available.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">
          {search ? "No matching users found." : "All users are already in this group."}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {available.slice(0, 20).map((u) => (
            <div key={u.id}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              data-testid={`available-user-${u.id}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  {(u.name || u.email)[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{u.name || <span className="italic text-slate-400">No name</span>}</p>
                  <p className="text-xs text-slate-400 truncate">{u.email}</p>
                </div>
                <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${ROLE_BADGE[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                  {u.role}
                </span>
              </div>
              <button
                onClick={() => addMember(u.id)}
                disabled={adding === u.id}
                className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                data-testid={`btn-add-${u.id}`}>
                {adding === u.id ? "…" : <><Check size={11} /> Add</>}
              </button>
            </div>
          ))}
          {available.length > 20 && (
            <p className="text-xs text-slate-400 text-center py-2">Showing 20 of {available.length}. Refine your search.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [companies, setCompanies] = useState<RefItem[]>([]);
  const [departments, setDepartments] = useState<RefItem[]>([]);
  const [functions, setFunctions] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const loadGroup = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/groups/${id}`)
      .then((r) => { if (r.status === 404) { setNotFound(true); return null; } return r.json(); })
      .then((d) => { if (d) setGroup(d); })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadGroup();
    fetch("/api/admin/users").then((r) => r.json()).then(setAllUsers);
    fetch("/api/admin/companies").then((r) => r.json()).then(setCompanies);
    fetch("/api/admin/departments").then((r) => r.json()).then(setDepartments);
    fetch("/api/admin/functions").then((r) => r.json()).then(setFunctions);
  }, [loadGroup]);

  const removeMember = async (userId: string) => {
    setRemoving(userId);
    await fetch(`/api/admin/groups/${id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    setRemoving(null);
    loadGroup();
  };

  const filteredMembers = group?.users.filter((m) =>
    !memberSearch ||
    m.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
    (m.name ?? "").toLowerCase().includes(memberSearch.toLowerCase())
  ) ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-400">Loading group…</div>
    );
  }

  if (notFound || !group) {
    return (
      <div className="text-center py-24">
        <p className="text-slate-500 text-sm mb-4">Group not found.</p>
        <button onClick={() => router.push("/admin/groups")}
          className="text-blue-600 text-sm font-medium hover:underline">← Back to Groups</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.push("/admin/groups")}
          className="mt-0.5 p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors flex-shrink-0"
          data-testid="btn-back">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-base">
              {group.name[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{group.name}</h1>
              {group.description && <p className="text-sm text-slate-500 mt-0.5">{group.description}</p>}
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowEdit(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-sm transition-colors"
          data-testid="btn-edit-group">
          <Pencil size={14} /> Edit Group
        </button>
      </div>

      {/* Details cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            icon: <Building2 size={14} className="text-blue-500" />,
            label: "Company",
            value: group.company?.name ?? "—",
          },
          {
            icon: <Crown size={14} className="text-amber-500" />,
            label: "Group Owner",
            value: group.owner ? (group.owner.name || group.owner.email) : "—",
            sub: group.owner ? group.owner.role : undefined,
          },
          {
            icon: <Layers size={14} className="text-indigo-500" />,
            label: "Department",
            value: group.department?.name ?? "—",
          },
          {
            icon: <Briefcase size={14} className="text-emerald-500" />,
            label: "Function",
            value: group.businessFunction?.name ?? "—",
          },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              {card.icon}
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{card.label}</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 truncate">{card.value}</p>
            {card.sub && <p className="text-[10px] text-slate-400 mt-0.5">{card.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Members list — 2/3 width */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-slate-500" />
                <span className="text-sm font-bold text-slate-800">
                  Members <span className="text-slate-400 font-normal">({group.users.length})</span>
                </span>
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Filter members…"
                  data-testid="input-filter-members"
                  className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                />
              </div>
            </div>

            {group.users.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <Users size={24} className="text-slate-200" />
                <p className="text-sm text-slate-400">No members yet. Add some from the panel →</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No members match your filter.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {filteredMembers.map((m) => (
                  <div key={m.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors"
                    data-testid={`member-${m.id}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {(m.name || m.email)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-900">
                            {m.name || <span className="italic text-slate-400">No name</span>}
                          </p>
                          {group.owner?.id === m.id && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold rounded-full">
                              <Crown size={9} /> Owner
                            </span>
                          )}
                          {!m.is_active && (
                            <span className="px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200 text-[10px] font-semibold rounded-full">Disabled</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ROLE_BADGE[m.role] ?? "bg-slate-100 text-slate-600"}`}>
                        {m.role}
                      </span>
                      <button
                        onClick={() => removeMember(m.id)}
                        disabled={removing === m.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        data-testid={`btn-remove-${m.id}`}
                        title="Remove from group">
                        {removing === m.id ? <span className="text-xs">…</span> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Add member panel — 1/3 width */}
        <div className="lg:col-span-1">
          <AddMemberPanel
            groupId={id}
            members={group.users}
            allUsers={allUsers}
            onAdded={loadGroup}
          />

          {/* Group stats */}
          <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Group Stats</h3>
            <div className="space-y-2">
              {[
                { label: "Total Members",  value: group.users.length },
                { label: "Active Members", value: group.users.filter((u) => u.is_active).length },
                { label: "Admins / Managers", value: group.users.filter((u) => ["ADMIN","MANAGER","SUPER_ADMIN"].includes(u.role)).length },
                { label: "Created",        value: fmtDate(group.created_at) },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{s.label}</span>
                  <span className="font-semibold text-slate-900">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <EditModal
          group={group}
          companies={companies}
          allUsers={allUsers}
          departments={departments}
          functions={functions}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); loadGroup(); }}
        />
      )}
    </div>
  );
}

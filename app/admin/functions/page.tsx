"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Briefcase, Plus, Pencil, Trash2, X, Layers, Building2, ChevronRight, Info } from "lucide-react";

interface RefItem { id: string; name: string }
interface BizFunction {
  id: string; name: string; created_at: string;
  company: RefItem | null;
  department: RefItem | null;
  _count: { users: number };
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

interface FormState {
  name: string; coId: string; deptId: string;
  setName: (v: string) => void; setCoId: (v: string) => void; setDeptId: (v: string) => void;
  companies: RefItem[]; departments: RefItem[];
  err: string; saving: boolean; onSubmit: () => void; onCancel: () => void; submitLabel: string;
}

function FunctionForm(p: FormState) {
  const filteredDepts = p.coId ? p.departments.filter((d: any) => d.company?.id === p.coId || d.company_id === p.coId) : p.departments;

  return (
    <div className="space-y-4">
      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 flex items-start gap-2">
        <Info size={13} className="mt-0.5 flex-shrink-0" />
        Select company first, then the department. Function inherits the org hierarchy.
      </div>

      {/* Company */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Company <span className="text-red-500">*</span></label>
        <select value={p.coId} onChange={(e) => { p.setCoId(e.target.value); p.setDeptId(""); }}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          data-testid="select-company">
          <option value="">— Select Company —</option>
          {p.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Department — cascaded */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Department <span className="text-red-500">*</span>
          {!p.coId && <span className="ml-1 text-slate-400 font-normal">(select company first)</span>}
        </label>
        <select value={p.deptId} onChange={(e) => p.setDeptId(e.target.value)}
          disabled={!p.coId}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
          data-testid="select-department">
          <option value="">— Select Department —</option>
          {filteredDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Function Name <span className="text-red-500">*</span></label>
        <input type="text" value={p.name} onChange={(e) => p.setName(e.target.value)}
          placeholder="e.g. Accounts Payable"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="input-name" />
      </div>

      {p.err && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <Info size={13} /> {p.err}
        </div>
      )}
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={p.onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
        <button onClick={p.onSubmit} disabled={p.saving || !p.name.trim() || !p.coId || !p.deptId}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          data-testid="btn-submit">
          {p.saving ? "Saving…" : p.submitLabel}
        </button>
      </div>
    </div>
  );
}

export default function FunctionsPage() {
  const [items, setItems]         = useState<BizFunction[]>([]);
  const [companies, setCompanies] = useState<RefItem[]>([]);
  const [departments, setDepts]   = useState<(RefItem & { company_id?: string; company?: RefItem })[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterCo, setFilterCo]   = useState("");
  const [filterDept, setFilterDept] = useState("");

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [cName, setCName]   = useState("");
  const [cCo, setCCo]       = useState("");
  const [cDept, setCDept]   = useState("");
  const [cErr, setCErr]     = useState("");
  const [cSaving, setCSaving] = useState(false);

  // Edit
  const [editItem, setEditItem] = useState<BizFunction | null>(null);
  const [eName, setEName]   = useState("");
  const [eCo, setECo]       = useState("");
  const [eDept, setEDept]   = useState("");
  const [eErr, setEErr]     = useState("");
  const [eSaving, setESaving] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/functions").then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetch("/api/admin/companies").then((r) => r.json()).then((d) => setCompanies(Array.isArray(d) ? d : []));
    fetch("/api/admin/departments").then((r) => r.json()).then((d) => setDepts(Array.isArray(d) ? d : []));
  }, [load]);

  const filteredDeptsByFilter = filterCo ? departments.filter((d) => d.company?.id === filterCo) : departments;

  const filtered = useMemo(() => {
    let r = items;
    if (filterCo)   r = r.filter((i) => i.company?.id === filterCo);
    if (filterDept) r = r.filter((i) => i.department?.id === filterDept);
    return r;
  }, [items, filterCo, filterDept]);

  const create = async () => {
    setCErr("");
    if (!cName.trim()) { setCErr("Name is required."); return; }
    if (!cCo)   { setCErr("Company is required."); return; }
    if (!cDept) { setCErr("Department is required."); return; }
    setCSaving(true);
    const res = await fetch("/api/admin/functions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cName, company_id: cCo, department_id: cDept }),
    });
    setCSaving(false);
    if (!res.ok) { const d = await res.json(); setCErr(d.error || "Failed."); return; }
    setShowCreate(false); setCName(""); setCCo(""); setCDept(""); load();
  };

  const saveEdit = async () => {
    setEErr("");
    if (!eName.trim()) { setEErr("Name is required."); return; }
    if (!eCo)   { setEErr("Company is required."); return; }
    if (!eDept) { setEErr("Department is required."); return; }
    setESaving(true);
    const res = await fetch("/api/admin/functions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editItem!.id, name: eName, company_id: eCo, department_id: eDept }),
    });
    setESaving(false);
    if (!res.ok) { const d = await res.json(); setEErr(d.error || "Failed."); return; }
    setEditItem(null); load();
  };

  const doDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await fetch("/api/admin/functions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteId }) });
    setDeleting(false); setDeleteId(null); load();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Functions</h1>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
            <Building2 size={13} className="text-slate-400" /> Company
            <ChevronRight size={12} className="text-slate-300" />
            <Layers size={13} className="text-blue-400" /> Department
            <ChevronRight size={12} className="text-slate-300" />
            <Briefcase size={13} className="text-emerald-500" /> <span className="font-semibold text-emerald-600">Function</span>
          </p>
        </div>
        <button onClick={() => { setShowCreate(true); setCName(""); setCCo(""); setCDept(""); setCErr(""); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          data-testid="btn-new-function">
          <Plus size={15} /> New Function
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg"><Briefcase size={15} className="text-emerald-500" /></div>
          <div><p className="text-xl font-bold text-slate-900">{items.length}</p><p className="text-xs text-slate-500">Functions</p></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Layers size={15} className="text-blue-400" /></div>
          <div><p className="text-xl font-bold text-slate-900">{new Set(items.map((i) => i.department?.id).filter(Boolean)).size}</p><p className="text-xs text-slate-500">Departments</p></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-slate-50 rounded-lg"><Building2 size={15} className="text-slate-400" /></div>
          <div><p className="text-xl font-bold text-slate-900">{new Set(items.map((i) => i.company?.id).filter(Boolean)).size}</p><p className="text-xs text-slate-500">Companies</p></div>
        </div>
      </div>

      {/* Cascading Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <Building2 size={14} className="text-slate-400" />
        <select value={filterCo} onChange={(e) => { setFilterCo(e.target.value); setFilterDept(""); }}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          data-testid="select-filter-company">
          <option value="">All companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <ChevronRight size={13} className="text-slate-300" />
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
          disabled={!filterCo}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
          data-testid="select-filter-dept">
          <option value="">All departments</option>
          {filteredDeptsByFilter.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {(filterCo || filterDept) && (
          <button onClick={() => { setFilterCo(""); setFilterDept(""); }} className="text-xs text-slate-500 hover:text-slate-800 underline">Clear</button>
        )}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} function{filtered.length !== 1 ? "s" : ""} shown</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <Briefcase size={24} className="text-slate-200" />
            <p className="text-sm text-slate-400">No functions found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["Function", "Department", "Company", "Users", "Created", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors" data-testid={`row-fn-${item.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Briefcase size={13} className="text-emerald-400 flex-shrink-0" />
                      <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.department ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium rounded-full">
                        <Layers size={9} /> {item.department.name}
                      </span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {item.company ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
                        <Building2 size={9} /> {item.company.name}
                      </span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{item._count.users}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(item.created_at)}</td>
                  <td className="px-4 py-3">
                    {deleteId === item.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600 font-medium">Delete?</span>
                        <button onClick={doDelete} disabled={deleting}
                          className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors">
                          {deleting ? "…" : "Yes"}
                        </button>
                        <button onClick={() => setDeleteId(null)} className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">No</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditItem(item); setEName(item.name); setECo(item.company?.id ?? ""); setEDept(item.department?.id ?? ""); setEErr(""); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          data-testid={`btn-edit-${item.id}`}><Pencil size={13} /></button>
                        <button onClick={() => setDeleteId(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          data-testid={`btn-delete-${item.id}`}><Trash2 size={13} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <Modal title="New Function" onClose={() => setShowCreate(false)}>
          <FunctionForm name={cName} setName={setCName} coId={cCo} setCoId={setCCo} deptId={cDept} setDeptId={setCDept}
            companies={companies} departments={departments} err={cErr} saving={cSaving}
            onSubmit={create} onCancel={() => setShowCreate(false)} submitLabel="Create Function" />
        </Modal>
      )}
      {editItem && (
        <Modal title={`Edit — ${editItem.name}`} onClose={() => setEditItem(null)}>
          <FunctionForm name={eName} setName={setEName} coId={eCo} setCoId={setECo} deptId={eDept} setDeptId={setEDept}
            companies={companies} departments={departments} err={eErr} saving={eSaving}
            onSubmit={saveEdit} onCancel={() => setEditItem(null)} submitLabel="Save Changes" />
        </Modal>
      )}
    </div>
  );
}

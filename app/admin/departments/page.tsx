"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Layers, Plus, Pencil, Trash2, X, Check, Building2, ChevronRight, Info } from "lucide-react";

interface RefItem { id: string; name: string }
interface Department {
  id: string; name: string; created_at: string;
  company: RefItem | null;
  _count: { functions: number; users: number };
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

export default function DepartmentsPage() {
  const [items, setItems]       = useState<Department[]>([]);
  const [companies, setCompanies] = useState<RefItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterCo, setFilterCo] = useState("");

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [cName, setCName]   = useState("");
  const [cCo, setCCo]       = useState("");
  const [cErr, setCErr]     = useState("");
  const [cSaving, setCSaving] = useState(false);

  // Edit
  const [editItem, setEditItem] = useState<Department | null>(null);
  const [eName, setEName]   = useState("");
  const [eCo, setECo]       = useState("");
  const [eErr, setEErr]     = useState("");
  const [eSaving, setESaving] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/departments").then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetch("/api/admin/companies").then((r) => r.json()).then((d) => setCompanies(Array.isArray(d) ? d : []));
  }, [load]);

  const filtered = useMemo(() =>
    !filterCo ? items : items.filter((i) => i.company?.id === filterCo),
    [items, filterCo]);

  const create = async () => {
    setCErr("");
    if (!cName.trim()) { setCErr("Name is required."); return; }
    if (!cCo) { setCErr("Company is required."); return; }
    setCSaving(true);
    const res = await fetch("/api/admin/departments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cName, company_id: cCo }),
    });
    setCSaving(false);
    if (!res.ok) { const d = await res.json(); setCErr(d.error || "Failed."); return; }
    setShowCreate(false); setCName(""); setCCo(""); load();
  };

  const saveEdit = async () => {
    setEErr("");
    if (!eName.trim()) { setEErr("Name is required."); return; }
    if (!eCo) { setEErr("Company is required."); return; }
    setESaving(true);
    const res = await fetch("/api/admin/departments", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editItem!.id, name: eName, company_id: eCo }),
    });
    setESaving(false);
    if (!res.ok) { const d = await res.json(); setEErr(d.error || "Failed."); return; }
    setEditItem(null); load();
  };

  const doDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await fetch("/api/admin/departments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteId }) });
    setDeleting(false); setDeleteId(null); load();
  };

  const coOpts = companies.map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
            <Building2 size={13} className="text-slate-400" /> Company
            <ChevronRight size={12} className="text-slate-300" />
            <Layers size={13} className="text-blue-400" /> <span className="font-semibold text-blue-600">Department</span>
            <ChevronRight size={12} className="text-slate-300" /> Function
          </p>
        </div>
        <button onClick={() => { setShowCreate(true); setCName(""); setCCo(""); setCErr(""); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          data-testid="btn-new-dept">
          <Plus size={15} /> New Department
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Layers size={15} className="text-blue-500" /></div>
          <div><p className="text-xl font-bold text-slate-900">{items.length}</p><p className="text-xs text-slate-500">Departments</p></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-slate-50 rounded-lg"><Building2 size={15} className="text-slate-400" /></div>
          <div><p className="text-xl font-bold text-slate-900">{new Set(items.map((i) => i.company?.id).filter(Boolean)).size}</p><p className="text-xs text-slate-500">Companies</p></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg"><Layers size={15} className="text-emerald-500" /></div>
          <div><p className="text-xl font-bold text-slate-900">{items.reduce((s, i) => s + i._count.functions, 0)}</p><p className="text-xs text-slate-500">Total Functions</p></div>
        </div>
      </div>

      {/* Filter by company */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
        <div className="flex items-center gap-3">
          <Building2 size={14} className="text-slate-400 flex-shrink-0" />
          <select value={filterCo} onChange={(e) => setFilterCo(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            data-testid="select-filter-company">
            <option value="">All companies</option>
            {coOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {filterCo && (
            <button onClick={() => setFilterCo("")} className="text-xs text-slate-500 hover:text-slate-800 underline">Clear</button>
          )}
          <span className="text-xs text-slate-400 ml-auto">{filtered.length} department{filtered.length !== 1 ? "s" : ""} shown</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <Layers size={24} className="text-slate-200" />
            <p className="text-sm text-slate-400">{filterCo ? "No departments for this company." : "No departments yet."}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["Department", "Company", "Functions", "Users", "Created", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors" data-testid={`row-dept-${item.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Layers size={13} className="text-blue-400 flex-shrink-0" />
                      <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.company ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
                        <Building2 size={10} /> {item.company.name}
                      </span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{item._count.functions}</td>
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
                        <button onClick={() => { setEditItem(item); setEName(item.name); setECo(item.company?.id ?? ""); setEErr(""); }}
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

      {/* Create Modal */}
      {showCreate && (
        <Modal title="New Department" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 flex items-start gap-2">
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              Department must be assigned to a company. Functions will be created under this department.
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Company <span className="text-red-500">*</span></label>
              <select value={cCo} onChange={(e) => setCCo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                data-testid="select-create-company">
                <option value="">— Select Company —</option>
                {coOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Department Name <span className="text-red-500">*</span></label>
              <input type="text" value={cName} onChange={(e) => setCName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="e.g. Finance"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="input-create-name" />
            </div>
            {cErr && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <Info size={13} /> {cErr}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
              <button onClick={create} disabled={cSaving || !cName.trim() || !cCo}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                data-testid="btn-submit-create">
                {cSaving ? "Creating…" : "Create Department"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editItem && (
        <Modal title={`Edit — ${editItem.name}`} onClose={() => setEditItem(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Company <span className="text-red-500">*</span></label>
              <select value={eCo} onChange={(e) => setECo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                data-testid="select-edit-company">
                <option value="">— Select Company —</option>
                {coOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Department Name <span className="text-red-500">*</span></label>
              <input type="text" value={eName} onChange={(e) => setEName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="input-edit-name" />
            </div>
            {eErr && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <Info size={13} /> {eErr}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setEditItem(null)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
              <button onClick={saveEdit} disabled={eSaving || !eName.trim() || !eCo}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                data-testid="btn-submit-edit">
                {eSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

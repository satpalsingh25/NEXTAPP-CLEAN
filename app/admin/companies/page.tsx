"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Users, Plus, X, ShieldCheck, Globe, Pencil, Layers,
  ChevronRight, PowerOff, Trash2, AlertTriangle, Power, Boxes, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface Country { id: string; name: string }
interface Company {
  id: string;
  name: string;
  primary_color: string;
  created_at: string;
  is_active: boolean;
  country: Country | null;
  _count: { users: number; compliances: number; departments: number };
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

export default function CompaniesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [companies, setCompanies] = useState<Company[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading]     = useState(true);

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [cName, setCName]     = useState("");
  const [cCountry, setCCountry] = useState("");
  const [cSaving, setCSaving] = useState(false);

  // Edit
  const [editCo, setEditCo]   = useState<Company | null>(null);
  const [eName, setEName]     = useState("");
  const [eCountry, setECountry] = useState("");
  const [eSaving, setESaving] = useState(false);

  // Delete confirm
  const [deleteCo, setDeleteCo]   = useState<Company | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Inline action error
  const [actionError, setActionError] = useState("");

  // Manage Modules
  type ModuleRow = { id: string; name: string; enabled: boolean };
  const [modulesCo,    setModulesCo]    = useState<Company | null>(null);
  const [moduleRows,   setModuleRows]   = useState<ModuleRow[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesSaving,  setModulesSaving]  = useState(false);
  const [modulesToast,   setModulesToast]   = useState("");

  const openModules = async (co: Company) => {
    setModulesCo(co);
    setModuleRows([]);
    setModulesLoading(true);
    try {
      const data = await fetch(`/api/admin/company-modules?company_id=${co.id}`).then((r) => r.json());
      setModuleRows(Array.isArray(data) ? data : []);
    } finally {
      setModulesLoading(false);
    }
  };

  const toggleModule = (id: string) =>
    setModuleRows((rows) => rows.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));

  const saveModules = async () => {
    if (!modulesCo) return;
    setModulesSaving(true);
    const res = await fetch("/api/admin/company-modules", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        company_id: modulesCo.id,
        modules:    moduleRows.map((r) => ({ module_id: r.id, enabled: r.enabled })),
      }),
    });
    setModulesSaving(false);
    if (res.ok) {
      setModulesToast("Modules updated");
      setModulesCo(null);
      setTimeout(() => setModulesToast(""), 2500);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch("/api/admin/companies").then((r) => r.json());
    setCompanies(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/admin/countries").then((r) => r.json()).then((d) => setCountries(Array.isArray(d) ? d : []));
  }, [load]);

  const create = async () => {
    if (!cName.trim()) return;
    setCSaving(true);
    await fetch("/api/admin/companies", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cName, country_id: cCountry || null }),
    });
    setCName(""); setCCountry(""); setCSaving(false); setShowCreate(false); load();
  };

  const saveEdit = async () => {
    if (!eName.trim() || !editCo) return;
    setESaving(true);
    await fetch("/api/admin/companies", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editCo.id, name: eName, country_id: eCountry || null }),
    });
    setESaving(false); setEditCo(null); load();
  };

  const toggleDisable = async (co: Company) => {
    setActionError("");
    const next = !co.is_active;
    const res = await fetch(`/api/admin/companies/${co.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: next }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setActionError(err.error || "Failed to update company status");
      return;
    }
    load();
  };

  const confirmDelete = async () => {
    if (!deleteCo) return;
    setDeleting(true);
    setDeleteError("");
    const res = await fetch(`/api/admin/companies/${deleteCo.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setDeleteError(err.error || "Failed to delete company");
      setDeleting(false);
      return;
    }
    setDeleting(false);
    setDeleteCo(null);
    load();
  };

  const totalUsers       = companies.reduce((s, c) => s + c._count.users, 0);
  const totalCompliances = companies.reduce((s, c) => s + c._count.compliances, 0);
  const countryOpts      = countries.map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
            <Globe size={13} className="text-slate-400" /> Country
            <ChevronRight size={12} className="text-slate-300" />
            <Building2 size={13} className="text-blue-500" /> <span className="font-semibold text-blue-600">Company</span>
            <ChevronRight size={12} className="text-slate-300" />
            <Layers size={13} className="text-slate-400" /> Department
          </p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => { setShowCreate(true); setCName(""); setCCountry(""); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
            data-testid="btn-new-company">
            <Plus size={15} /> New Company
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: <Building2 size={20} className="text-blue-600" />, bg: "bg-blue-50", label: "Companies", value: companies.length },
          { icon: <Users size={20} className="text-indigo-600" />, bg: "bg-indigo-50", label: "Total Users", value: totalUsers },
          { icon: <ShieldCheck size={20} className="text-green-600" />, bg: "bg-green-50", label: "Total Compliances", value: totalCompliances },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
            <div className={`${s.bg} p-3 rounded-lg`}>{s.icon}</div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Inline action error banner */}
      {actionError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle size={15} className="shrink-0" />
          {actionError}
          <button onClick={() => setActionError("")} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-700">{companies.length} compan{companies.length !== 1 ? "ies" : "y"}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" /></div>
        ) : companies.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Building2 size={36} className="mx-auto text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">No companies yet. Click "New Company" to add one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {["Company", "Country", "Departments", "Users", "Compliances", "Created", "Status", "Actions"].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors group" data-testid={`row-co-${c.id}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: c.primary_color || "#2563eb" }}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {c.country ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium rounded-full">
                          <Globe size={10} /> {c.country.name}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                        <Layers size={12} className="text-slate-400" /> {c._count.departments}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                        <Users size={12} className="text-slate-400" /> {c._count.users}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                        <ShieldCheck size={12} className="text-slate-400" /> {c._count.compliances}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">{fmtDate(c.created_at)}</td>

                    {/* Status badge */}
                    <td className="px-5 py-4">
                      {c.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      {isSuperAdmin && (
                        <div className="flex items-center gap-1">
                          {/* Edit */}
                          <button
                            onClick={() => { setEditCo(c); setEName(c.name); setECountry(c.country?.id ?? ""); }}
                            title="Edit"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            data-testid={`btn-edit-${c.id}`}>
                            <Pencil size={14} />
                          </button>

                          {/* Manage Modules */}
                          <button
                            onClick={() => openModules(c)}
                            title="Manage Modules"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            data-testid={`btn-modules-${c.id}`}>
                            <Boxes size={14} />
                          </button>

                          {/* Disable / Enable */}
                          <button
                            onClick={() => toggleDisable(c)}
                            title={c.is_active ? "Disable" : "Enable"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              c.is_active
                                ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                : "text-slate-400 hover:text-green-600 hover:bg-green-50"
                            }`}
                            data-testid={`btn-toggle-${c.id}`}>
                            {c.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => { setDeleteCo(c); setDeleteError(""); }}
                            title="Delete"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            data-testid={`btn-delete-${c.id}`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
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
        <Modal title="New Company" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Country</label>
              <select value={cCountry} onChange={(e) => setCCountry(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                data-testid="select-country">
                <option value="">— No country —</option>
                {countryOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Company Name <span className="text-red-500">*</span></label>
              <input type="text" value={cName} onChange={(e) => setCName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="e.g. Acme Corporation"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="input-company-name" />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
              <button onClick={create} disabled={cSaving || !cName.trim()}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                data-testid="btn-submit-create">
                {cSaving ? "Creating…" : "Create Company"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editCo && (
        <Modal title={`Edit — ${editCo.name}`} onClose={() => setEditCo(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Country</label>
              <select value={eCountry} onChange={(e) => setECountry(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                data-testid="select-edit-country">
                <option value="">— No country —</option>
                {countryOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Company Name <span className="text-red-500">*</span></label>
              <input type="text" value={eName} onChange={(e) => setEName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="input-edit-name" />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setEditCo(null)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
              <button onClick={saveEdit} disabled={eSaving || !eName.trim()}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                data-testid="btn-submit-edit">
                {eSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manage Modules Modal */}
      {modulesCo && (
        <Modal title={`Manage Modules — ${modulesCo.name}`} onClose={() => !modulesSaving && setModulesCo(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-500" />
              Disabling a module hides it from the sidebar and blocks its APIs. Existing data is preserved and reappears when re-enabled.
            </div>

            {modulesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : moduleRows.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No modules configured.</p>
            ) : (
              <div className="space-y-1">
                {moduleRows.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                    data-testid={`module-row-${m.name}`}
                  >
                    <span className="text-sm font-medium text-slate-800">{m.name}</span>
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      onChange={() => toggleModule(m.id)}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                      data-testid={`module-toggle-${m.name}`}
                    />
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setModulesCo(null)}
                disabled={modulesSaving}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveModules}
                disabled={modulesSaving || modulesLoading || moduleRows.length === 0}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                data-testid="btn-save-modules"
              >
                {modulesSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Module update toast */}
      {modulesToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-green-600 text-white text-sm font-semibold rounded-xl shadow-lg">
          <Check size={15} /> {modulesToast}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteCo && (
        <Modal title="Delete Company" onClose={() => !deleting && setDeleteCo(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">This action cannot be undone</p>
                <p className="text-sm text-red-600 mt-0.5">
                  You are about to permanently delete <span className="font-bold">{deleteCo.name}</span>.
                  This will fail if the company has linked users, compliance records, or AMC records.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                {deleteError}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setDeleteCo(null)} disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="px-5 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                data-testid="btn-confirm-delete">
                {deleting ? "Deleting…" : "Delete Company"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

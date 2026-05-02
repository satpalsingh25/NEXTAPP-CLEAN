"use client";

import { useEffect, useState, useCallback } from "react";
import { Globe, Plus, Pencil, Trash2, X, Check, Building2 } from "lucide-react";

interface Country { id: string; name: string; created_at: string; _count: { companies: number } }

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function CountriesPage() {
  const [items, setItems]       = useState<Country[]>([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting]     = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/countries").then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    await fetch("/api/admin/countries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) });
    setNewName(""); setSaving(false); setCreating(false); load();
  };
  const saveEdit = async () => {
    if (!editName.trim() || !editId) return;
    setSaving(true);
    await fetch("/api/admin/countries", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editId, name: editName }) });
    setSaving(false); setEditId(null); setEditName(""); load();
  };
  const doDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    await fetch("/api/admin/countries", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deletingId }) });
    setDeleting(false); setDeletingId(null); load();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Countries</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Top of the org hierarchy · <span className="font-medium">Country → Company → Department → Function</span>
          </p>
        </div>
        <button onClick={() => { setCreating(true); setNewName(""); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          data-testid="btn-new-country">
          <Plus size={15} /> New Country
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Globe size={16} className="text-blue-500" /></div>
          <div><p className="text-xl font-bold text-slate-900">{items.length}</p><p className="text-xs text-slate-500">Countries</p></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg"><Building2 size={16} className="text-indigo-500" /></div>
          <div>
            <p className="text-xl font-bold text-slate-900">{items.reduce((s, i) => s + i._count.companies, 0)}</p>
            <p className="text-xs text-slate-500">Mapped Companies</p>
          </div>
        </div>
      </div>

      {creating && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4 flex items-center gap-3">
          <Globe size={15} className="text-blue-400 flex-shrink-0" />
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") setCreating(false); }}
            placeholder="Country name…"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="input-new-country" />
          <button onClick={create} disabled={saving || !newName.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <Check size={13} /> {saving ? "…" : "Add"}
          </button>
          <button onClick={() => setCreating(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"><X size={14} /></button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-700">{items.length} countr{items.length !== 1 ? "ies" : "y"}</span>
        </div>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Loading…</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <Globe size={24} className="text-slate-200" />
            <p className="text-sm text-slate-400">No countries yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["Country", "Companies", "Created", ""].map((h, i) => (
                  <th key={i} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors" data-testid={`row-country-${item.id}`}>
                  <td className="px-5 py-3">
                    {editId === item.id ? (
                      <div className="flex items-center gap-2">
                        <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }}
                          className="border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                          data-testid={`input-edit-${item.id}`} />
                        <button onClick={saveEdit} disabled={saving} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"><Check size={12} /></button>
                        <button onClick={() => setEditId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"><X size={12} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Globe size={14} className="text-slate-400" />
                        <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                      <Building2 size={12} className="text-slate-400" /> {item._count.companies}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">{fmtDate(item.created_at)}</td>
                  <td className="px-5 py-3">
                    {deletingId === item.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600 font-medium">Delete?</span>
                        <button onClick={doDelete} disabled={deleting}
                          className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors">
                          {deleting ? "…" : "Yes"}
                        </button>
                        <button onClick={() => setDeletingId(null)} className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">No</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditId(item.id); setEditName(item.name); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          data-testid={`btn-edit-${item.id}`}><Pencil size={13} /></button>
                        <button onClick={() => setDeletingId(item.id)}
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
    </div>
  );
}

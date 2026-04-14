"use client";

import { useEffect, useState } from "react";
import { Plus, X, FileText, RefreshCw } from "lucide-react";

interface ComplianceTemplate {
  id: string;
  name: string;
  title: string;
  frequency: string;
  approval_levels: number;
  company_id: string;
}

const FREQUENCIES = ["Daily", "Weekly", "Monthly", "Quarterly", "Half-Yearly", "Yearly"];

export default function ComplianceTemplatesPage() {
  const [templates, setTemplates] = useState<ComplianceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("Monthly");
  const [approvalLevels, setApprovalLevels] = useState(1);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/compliance/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName(""); setFrequency("Monthly"); setApprovalLevels(1); setError("");
  };

  const submit = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/compliance/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), frequency, approval_levels: approvalLevels }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to create template");
      return;
    }
    resetForm();
    setShowForm(false);
    load();
  };

  const freqColor: Record<string, string> = {
    Daily: "bg-red-50 text-red-700 border border-red-200",
    Weekly: "bg-orange-50 text-orange-700 border border-orange-200",
    Monthly: "bg-blue-50 text-blue-700 border border-blue-200",
    Quarterly: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    "Half-Yearly": "bg-purple-50 text-purple-700 border border-purple-200",
    Yearly: "bg-green-50 text-green-700 border border-green-200",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Compliance Templates</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? "Loading…" : `${templates.length} template${templates.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => { setShowForm((v) => !v); resetForm(); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Cancel" : "New Template"}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-5">
            Create Compliance Template
          </h2>
          {error && (
            <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Template Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monthly Tax Filing"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Frequency *</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Approval Levels *</label>
              <select
                value={approvalLevels}
                onChange={(e) => setApprovalLevels(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} Level{n > 1 ? "s" : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-5">
            <button
              onClick={submit}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Creating…" : "Create Template"}
            </button>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm text-slate-400">
          <FileText size={40} className="mb-3 opacity-40" />
          <p className="font-medium">No templates yet</p>
          <p className="text-sm mt-1">Create your first compliance template to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FileText size={18} className="text-blue-600" />
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${freqColor[t.frequency] || "bg-slate-100 text-slate-600"}`}>
                  {t.frequency}
                </span>
              </div>
              <h3 className="font-semibold text-slate-900 text-sm leading-snug mb-3">{t.name || t.title}</h3>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>
                  <span className="font-medium text-slate-700">{t.approval_levels}</span>{" "}
                  Approval Level{t.approval_levels !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

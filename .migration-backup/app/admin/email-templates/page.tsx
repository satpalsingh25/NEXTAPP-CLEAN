"use client";

import { useEffect, useState } from "react";
import {
  Mail, FileText, Save, RefreshCw, CheckCircle2,
  AlertCircle, Bell, ShieldCheck, AlertTriangle,
} from "lucide-react";

type TemplateType = "REMINDER" | "APPROVAL" | "OVERDUE";

interface EmailTemplate {
  id?:      string;
  type:     TemplateType;
  subject:  string;
  body:     string;
}

const TEMPLATE_TYPES: {
  type:        TemplateType;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  color:       string;
}[] = [
  {
    type:        "REMINDER",
    label:       "Reminder",
    description: "Sent to assigned users before a compliance/AMC is due",
    icon:        <Bell size={16} />,
    color:       "blue",
  },
  {
    type:        "APPROVAL",
    label:       "Approval",
    description: "Sent to approvers when action is required",
    icon:        <ShieldCheck size={16} />,
    color:       "violet",
  },
  {
    type:        "OVERDUE",
    label:       "Overdue",
    description: "Sent when a compliance/AMC record becomes overdue",
    icon:        <AlertTriangle size={16} />,
    color:       "red",
  },
];

const DEFAULT_TEMPLATES: Record<TemplateType, EmailTemplate> = {
  REMINDER: {
    type:    "REMINDER",
    subject: "Reminder: {{compliance_name}}",
    body:    "Hello {{user_name}},\n\nYour compliance \"{{compliance_name}}\" is due on {{due_date}}.\n\nPlease take action before the due date.\n\nRegards,\nCompliance Team",
  },
  APPROVAL: {
    type:    "APPROVAL",
    subject: "Approval Required: {{compliance_name}}",
    body:    "Hello {{user_name}},\n\n\"{{compliance_name}}\" is awaiting your approval and is due on {{due_date}}.\n\nPlease review and take action.\n\nRegards,\nCompliance Team",
  },
  OVERDUE: {
    type:    "OVERDUE",
    subject: "Overdue: {{compliance_name}}",
    body:    "Hello {{user_name}},\n\nYour compliance \"{{compliance_name}}\" was due on {{due_date}} and is now overdue.\n\nPlease take immediate action.\n\nRegards,\nCompliance Team",
  },
};

const VARIABLE_CHIPS = [
  { label: "{{user_name}}",       desc: "Recipient's name" },
  { label: "{{compliance_name}}", desc: "Compliance or AMC name" },
  { label: "{{due_date}}",        desc: "Due date" },
];

const COLOR_MAP: Record<string, string> = {
  blue:   "bg-blue-50 border-blue-200 text-blue-700",
  violet: "bg-violet-50 border-violet-200 text-violet-700",
  red:    "bg-red-50 border-red-200 text-red-700",
};

const ICON_BG_MAP: Record<string, string> = {
  blue:   "bg-blue-600",
  violet: "bg-violet-600",
  red:    "bg-red-600",
};

type SaveState = { msg: string; err: string };

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<Record<TemplateType, EmailTemplate>>({ ...DEFAULT_TEMPLATES });
  const [active,    setActive]    = useState<TemplateType>("REMINDER");
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [status,    setStatus]    = useState<SaveState>({ msg: "", err: "" });

  useEffect(() => {
    fetch("/api/admin/email-templates", { credentials: "include" })
      .then((r) => r.json())
      .then((data: EmailTemplate[]) => {
        if (Array.isArray(data)) {
          const map = { ...DEFAULT_TEMPLATES };
          for (const t of data) {
            map[t.type] = t;
          }
          setTemplates(map);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function setField(field: "subject" | "body", value: string) {
    setTemplates((prev) => ({
      ...prev,
      [active]: { ...prev[active], [field]: value },
    }));
    setStatus({ msg: "", err: "" });
  }

  function insertVariable(variable: string) {
    setTemplates((prev) => ({
      ...prev,
      [active]: {
        ...prev[active],
        body: prev[active].body + variable,
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setStatus({ msg: "", err: "" });
    const tpl = templates[active];
    try {
      const method = tpl.id ? "PUT" : "POST";
      const url    = tpl.id
        ? `/api/admin/email-templates/${tpl.id}`
        : "/api/admin/email-templates";

      const res  = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: tpl.type, subject: tpl.subject, body: tpl.body }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus({ msg: "", err: json.error ?? "Failed to save." });
      } else {
        setTemplates((prev) => ({
          ...prev,
          [active]: { ...prev[active], id: json.id },
        }));
        setStatus({ msg: "Template saved successfully.", err: "" });
      }
    } catch {
      setStatus({ msg: "", err: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  const current = templates[active];
  const meta    = TEMPLATE_TYPES.find((t) => t.type === active)!;

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-10 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-600 text-white shadow-sm">
          <Mail size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Email Templates</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Customize the emails sent for reminders, approvals, and overdue notices
          </p>
        </div>
      </div>

      {/* Variable chips reference */}
      <div className="mb-6 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
          Available variables:
        </span>
        {VARIABLE_CHIPS.map((v) => (
          <span
            key={v.label}
            title={v.desc}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200 rounded-lg cursor-default"
            data-testid={`chip-variable-${v.label}`}
          >
            {v.label}
          </span>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TEMPLATE_TYPES.map((t) => (
          <button
            key={t.type}
            onClick={() => { setActive(t.type); setStatus({ msg: "", err: "" }); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
              active === t.type
                ? `${COLOR_MAP[t.color]} border`
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            data-testid={`tab-template-${t.type.toLowerCase()}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Template Editor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Type header */}
        <div className={`px-6 py-4 flex items-center gap-3 border-b border-slate-100`}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${ICON_BG_MAP[meta.color]} text-white`}>
            {meta.icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{meta.label} Template</p>
            <p className="text-xs text-slate-500">{meta.description}</p>
          </div>
          {current.id && (
            <span className="ml-auto text-xs text-green-600 font-medium flex items-center gap-1">
              <CheckCircle2 size={12} /> Saved
            </span>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={current.subject}
              onChange={(e) => setField("subject", e.target.value)}
              placeholder="e.g. Reminder: {{compliance_name}}"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid={`input-subject-${active.toLowerCase()}`}
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Body <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-1.5">
                {VARIABLE_CHIPS.map((v) => (
                  <button
                    key={v.label}
                    onClick={() => insertVariable(v.label)}
                    title={`Insert ${v.label}`}
                    className="text-xs font-mono px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md border border-slate-200 transition-colors"
                    data-testid={`btn-insert-${v.label.replace(/[{}]/g, "")}`}
                  >
                    + {v.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={current.body}
              onChange={(e) => setField("body", e.target.value)}
              rows={10}
              placeholder="Write your email body here. Use {{user_name}}, {{compliance_name}}, {{due_date}} as variables."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y font-mono leading-relaxed"
              data-testid={`textarea-body-${active.toLowerCase()}`}
            />
            <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
              <FileText size={11} />
              Use the buttons above to insert variable placeholders at the end of the body.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 space-y-3">
          {status.msg && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5" data-testid="msg-save-success">
              <CheckCircle2 size={14} /> {status.msg}
            </div>
          )}
          {status.err && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5" data-testid="msg-save-error">
              <AlertCircle size={14} /> {status.err}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !current.subject.trim() || !current.body.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="btn-save-template"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving…" : "Save Template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

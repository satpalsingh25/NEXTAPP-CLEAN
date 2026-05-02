"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, AlertCircle, ChevronDown } from "lucide-react";

interface Template   { id: string; title?: string; name?: string; frequency: string; approval_levels: number }
interface Department { id: string; name: string }
interface Func       { id: string; name: string; department_id?: string | null }
interface UserOption { id: string; name?: string | null; email: string; role: string }

const CREDS = { credentials: "include" } as const;

function SelectField({
  label, required, testId, value, onChange, disabled, children, loading,
}: {
  label: string; required?: boolean; testId: string; value: string;
  onChange: (v: string) => void; disabled?: boolean; children: React.ReactNode; loading?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {loading ? (
        <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
      ) : (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            data-testid={testId}
            className="w-full appearance-none px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 pr-9"
          >
            {children}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      )}
    </div>
  );
}

function NumberInput({ label, testId, value, onChange, min, max, placeholder }: {
  label: string; testId: string; value: string; onChange: (v: string) => void;
  min?: number; max?: number; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        placeholder={placeholder}
        data-testid={testId}
        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

export default function CreateCompliancePage() {
  const router = useRouter();

  const [templates,    setTemplates]    = useState<Template[]>([]);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [functions,    setFunctions]    = useState<Func[]>([]);
  const [users,        setUsers]        = useState<UserOption[]>([]);
  const [loadingMeta,  setLoadingMeta]  = useState(true);
  const [templateError, setTemplateError] = useState("");

  const [complianceName, setComplianceName] = useState("");
  const [templateId,     setTemplateId]     = useState("");
  const [departmentId,   setDepartmentId]   = useState("");
  const [functionId,     setFunctionId]     = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [startDate,      setStartDate]      = useState("");
  const [dueDay,         setDueDay]         = useState("");
  const [reminderDays,   setReminderDays]   = useState("");

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState("");

  // Skip the first department-change effect (on mount)
  const deptMounted = useRef(false);

  // Fetch all reference data in parallel on mount
  useEffect(() => {
    setLoadingMeta(true);
    Promise.all([
      fetch("/api/compliance/templates", CREDS).then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/departments",    CREDS).then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/functions",      CREDS).then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/users",          CREDS).then((r) => r.ok ? r.json() : []),
    ])
      .then(([tmpl, dept, fn, usr]) => {
        const tmplList = Array.isArray(tmpl) ? tmpl : [];
        setTemplates(tmplList);
        if (tmplList.length === 0) setTemplateError("No compliance templates found. Please create a template first.");
        setDepartments(Array.isArray(dept) ? dept : []);
        setFunctions(Array.isArray(fn)   ? fn   : []);
        setUsers(Array.isArray(usr)      ? usr  : []);
      })
      .catch(() => setTemplateError("Failed to load form data."))
      .finally(() => setLoadingMeta(false));
  }, []);

  // Re-fetch users filtered by department whenever department changes
  useEffect(() => {
    if (!deptMounted.current) { deptMounted.current = true; return; }
    setAssignedUserId("");
    setLoadingUsers(true);
    const url = departmentId
      ? `/api/admin/users?department_id=${departmentId}`
      : "/api/admin/users";
    fetch(url, CREDS)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, [departmentId]);

  // Auto-fill compliance name from selected template; allow override
  useEffect(() => {
    const t = templates.find((t) => t.id === templateId);
    setComplianceName(t ? (t.title || t.name || "") : "");
  }, [templateId, templates]);

  // Filter functions by selected department
  const visibleFunctions = departmentId
    ? functions.filter((f) => f.department_id === departmentId)
    : functions;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!templateId)                   { setFormError("Please select a template.");        return; }
    if (!complianceName.trim())        { setFormError("Compliance Name is required.");     return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/compliance", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        ...CREDS,
        body: JSON.stringify({
          name:           complianceName.trim(),
          templateId,
          departmentId:   departmentId   || undefined,
          functionId:     functionId     || undefined,
          assignedUserId: assignedUserId || undefined,
          startDate:      startDate      || undefined,
          dueDay:         dueDay         ? Number(dueDay)       : undefined,
          reminderDays:   reminderDays   ? Number(reminderDays) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Failed to create compliance record."); return; }

      router.refresh();
      router.push("/compliance");
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && !loadingMeta && templates.length > 0;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-50 rounded-xl">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Create Compliance Record</h1>
          <p className="text-sm text-slate-500 mt-0.5">Fill in the details to create a new compliance entry</p>
        </div>
      </div>

      {templateError && (
        <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" data-testid="error-template-load">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Error</p>
            <p className="mt-0.5">{templateError}</p>
            {templateError.includes("No compliance templates") && (
              <a href="/compliance/templates" className="underline font-medium mt-1 inline-block">Go to Templates →</a>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        {formError && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg" data-testid="error-form">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Template */}
        <SelectField label="Template" required testId="select-template" value={templateId} onChange={setTemplateId} disabled={templates.length === 0} loading={loadingMeta}>
          <option value="">{loadingMeta ? "Loading…" : templates.length === 0 ? "No templates available" : "Select a template…"}</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title || t.name} — {t.frequency} ({t.approval_levels} level{t.approval_levels !== 1 ? "s" : ""})
            </option>
          ))}
        </SelectField>

        {/* Compliance Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Compliance Name<span className="text-red-500 ml-0.5">*</span>
          </label>
          {loadingMeta ? (
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <input
              type="text"
              value={complianceName}
              onChange={(e) => setComplianceName(e.target.value)}
              placeholder="Enter compliance name"
              data-testid="input-compliance-name"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}
        </div>

        {/* Department + Function side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField label="Department" testId="select-department" value={departmentId} onChange={(v) => { setDepartmentId(v); setFunctionId(""); }} loading={loadingMeta}>
            <option value="">None</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>

          <SelectField label="Function" testId="select-function" value={functionId} onChange={setFunctionId} disabled={visibleFunctions.length === 0} loading={loadingMeta}>
            <option value="">None</option>
            {visibleFunctions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </SelectField>
        </div>

        {/* Assigned User — filtered by selected department */}
        <SelectField
          label={`Assigned User${departmentId ? " (filtered by department)" : ""}`}
          testId="select-assigned-user"
          value={assignedUserId}
          onChange={setAssignedUserId}
          loading={loadingMeta || loadingUsers}
          disabled={loadingUsers}
        >
          <option value="">
            {loadingUsers
              ? "Loading users…"
              : users.length === 0 && departmentId
              ? "No users in this department"
              : "Unassigned"}
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ? `${u.name} (${u.email})` : u.email} — {u.role}
            </option>
          ))}
        </SelectField>

        {/* Start Date + Due Day side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="input-start-date"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <NumberInput
            label="Due Day (day of month)"
            testId="input-due-day"
            value={dueDay}
            onChange={setDueDay}
            min={1}
            max={31}
            placeholder="e.g. 15"
          />
        </div>

        {/* Reminder Days */}
        <NumberInput
          label="Reminder Days (before due)"
          testId="input-reminder-days"
          value={reminderDays}
          onChange={setReminderDays}
          min={0}
          placeholder="e.g. 7"
        />

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            data-testid="btn-create"
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Creating…" : "Create Record"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/compliance")}
            data-testid="btn-cancel"
            className="px-5 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

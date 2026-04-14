"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface ComplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ComplianceSubmissionData) => Promise<void>;
  templates: Template[];
  isLoading?: boolean;
}

interface Template {
  id: string;
  title: string;
}

export interface ComplianceSubmissionData {
  template_id: string;
  due_date: string;
}

export default function ComplianceModal({
  isOpen,
  onClose,
  onSubmit,
  templates,
  isLoading = false,
}: ComplianceModalProps) {
  const [templateId, setTemplateId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!templateId || !dueDate) {
      setError("Please fill all required fields");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        template_id: templateId,
        due_date: dueDate,
      });
      setTemplateId("");
      setDueDate("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit compliance");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Submit New Compliance</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="template" className="block text-sm font-medium text-slate-700 mb-2">
              Compliance Template
            </label>
            <select
              id="template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-900"
              disabled={isLoading || submitting}
            >
              <option value="">Select a template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="due-date" className="block text-sm font-medium text-slate-700 mb-2">
              Due Date
            </label>
            <input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-900"
              disabled={isLoading || submitting}
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
              disabled={submitting || isLoading}
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

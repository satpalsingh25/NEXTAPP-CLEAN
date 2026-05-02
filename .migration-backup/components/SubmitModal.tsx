"use client";

import { useState } from "react";
import { X, Send, Paperclip, RefreshCw, AlertCircle } from "lucide-react";

interface SubmitModalProps {
  endpoint: string;
  title: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SubmitModal({ endpoint, title, onClose, onSuccess }: SubmitModalProps) {
  const [remarks, setRemarks] = useState("");
  const [fileUrl, setFileUrl]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const remarksEmpty = remarks.trim() === "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (remarksEmpty) return;
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: remarks.trim(), file_url: fileUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Submit failed.");
      } else {
        onSuccess();
        onClose();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white">
              <Send size={15} />
            </div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            data-testid="btn-close-submit-modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              placeholder="Enter submission remarks…"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
              data-testid="input-submit-remarks"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              <span className="inline-flex items-center gap-1.5">
                <Paperclip size={12} />
                Attachment URL
                <span className="text-slate-400 font-normal">(optional)</span>
              </span>
            </label>
            <input
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://…"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
              data-testid="input-submit-file-url"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2.5">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              data-testid="btn-cancel-submit"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || remarksEmpty}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="btn-confirm-submit"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              {loading ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

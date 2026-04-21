"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Upload, FolderPlus, RefreshCw, AlertCircle,
  Folder, FileText, Download, FolderOpen,
  X, Loader2, Users, Eye,
  FileX, List, LayoutGrid, Pencil, Trash2, ShieldCheck,
  CheckCircle2, Plus, CheckSquare2, Square, History,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface DmsFolder {
  id:         string;
  name:       string;
  path:       string;
  type:       string;
  created_at: string;
}

interface DmsFile {
  id:          string;
  name:        string;
  file_url:    string;
  uploaded_by: string;
  created_at:  string;
}

interface BreadcrumbEntry {
  id:   string;
  name: string;
}

interface FolderAccess {
  can_read:   boolean;
  can_upload: boolean;
  can_write:  boolean;
  can_delete: boolean;
}

interface CtxMenu {
  x:               number;
  y:               number;
  item:            DmsFolder | DmsFile;
  kind:            "folder" | "file";
  access:          FolderAccess;
  canManageAccess: boolean;
}

type ViewMode = "list" | "grid";

type AccessType = "USER" | "GROUP" | "DEPARTMENT" | "FUNCTION" | "COMPANY";

interface AccessEntity { id: string; name: string; }

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function getFileExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

type PreviewKind = "pdf" | "image" | "unsupported";

function classifyFile(name: string): PreviewKind {
  const ext = getFileExt(name);
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
  return "unsupported";
}

function proxyUrl(file_id: string, download = false) {
  return `/api/dms/file?file_id=${file_id}${download ? "&download=true" : ""}`;
}

/* ─── Context Menu ───────────────────────────────────────────────────────── */

function ContextMenuPopup({
  menu, onView, onUpload, onNewFolder, onRename, onActivity, onDelete, onManageAccess, onClose,
}: {
  menu:            CtxMenu;
  onView:          () => void;
  onUpload:        () => void;
  onNewFolder:     () => void;
  onRename:        () => void;
  onActivity:      () => void;
  onDelete:        () => void;
  onManageAccess:  () => void;
  onClose:         () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent) { if (e.key === "Escape") onClose(); return; }
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle as EventListener);
    document.addEventListener("keydown",   handle as EventListener);
    return () => {
      document.removeEventListener("mousedown", handle as EventListener);
      document.removeEventListener("keydown",   handle as EventListener);
    };
  }, [onClose]);

  const vw = typeof window !== "undefined" ? window.innerWidth  : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const estW = 192, estH = 200;
  const left = menu.x + estW > vw ? menu.x - estW : menu.x;
  const top  = menu.y + estH > vh ? menu.y - estH : menu.y;

  const { access, kind } = menu;

  const items = [
    { show: access.can_read,
      icon:  kind === "folder" ? <FolderOpen size={13}/> : <Eye size={13}/>,
      label: kind === "folder" ? "Open" : "Preview",
      action: onView },
    { show: access.can_upload && kind === "folder",
      icon: <Upload size={13}/>, label: "Upload file here", action: onUpload },
    { show: access.can_upload && kind === "folder",
      icon: <FolderPlus size={13}/>, label: "New Folder",  action: onNewFolder },
    { show: access.can_write,
      icon: <Pencil size={13}/>,  label: "Rename",  action: onRename },
    { show: true,
      icon: <History size={13}/>, label: "Activity", action: onActivity },
    { show: menu.canManageAccess,
      icon: <ShieldCheck size={13}/>, label: "Manage Access", action: onManageAccess, highlight: true },
    { show: access.can_delete,
      icon: <Trash2 size={13}/>,  label: "Delete",  action: onDelete, danger: true },
  ].filter((i) => i.show);

  if (items.length === 0) {
    items.push({ show: true, icon: <X size={13}/>, label: "No actions available", action: onClose });
  }

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-48"
      style={{ top, left }}
      data-testid="context-menu"
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.action(); onClose(); }}
          className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium transition-colors text-left
            ${(item as { danger?: boolean }).danger
              ? "text-red-600 hover:bg-red-50"
              : (item as { highlight?: boolean }).highlight
              ? "text-blue-600 hover:bg-blue-50"
              : "text-slate-700 hover:bg-slate-50"}`}
          data-testid={`ctx-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {item.icon} {item.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Root Context Menu (admin right-click on root) ─────────────────────── */

function RootContextMenuPopup({
  x, y, onNewFolder, onClose,
}: {
  x:           number;
  y:           number;
  onNewFolder: () => void;
  onClose:     () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent) { if (e.key === "Escape") onClose(); return; }
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle as EventListener);
    document.addEventListener("keydown",   handle as EventListener);
    return () => {
      document.removeEventListener("mousedown", handle as EventListener);
      document.removeEventListener("keydown",   handle as EventListener);
    };
  }, [onClose]);

  const vw   = typeof window !== "undefined" ? window.innerWidth  : 1200;
  const vh   = typeof window !== "undefined" ? window.innerHeight : 800;
  const estW = 192, estH = 60;
  const left = x + estW > vw ? x - estW : x;
  const top  = y + estH > vh ? y - estH : y;

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top, left, zIndex: 100 }}
      className="bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-48"
      data-testid="root-context-menu"
    >
      <button
        onClick={onNewFolder}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors rounded-lg font-medium"
        data-testid="ctx-new-team-folder"
      >
        <FolderPlus size={13} className="text-blue-500"/> New Team Folder
      </button>
    </div>
  );
}

/* ─── Manage Access Modal ────────────────────────────────────────────────── */

const ACCESS_TYPE_OPTIONS: { value: AccessType; label: string }[] = [
  { value: "USER",       label: "User"       },
  { value: "GROUP",      label: "Group"      },
  { value: "DEPARTMENT", label: "Department" },
  { value: "FUNCTION",   label: "Function"   },
  { value: "COMPANY",    label: "Company"    },
];

/* Styling maps */
const TYPE_COLORS: Record<AccessType, string> = {
  USER:       "bg-blue-100 text-blue-700",
  GROUP:      "bg-purple-100 text-purple-700",
  DEPARTMENT: "bg-amber-100 text-amber-700",
  FUNCTION:   "bg-teal-100 text-teal-700",
  COMPANY:    "bg-indigo-100 text-indigo-700",
};

const PERM_BADGES = [
  { key: "can_read",   label: "Read",   cls: "bg-sky-100 text-sky-700"     },
  { key: "can_upload", label: "Upload", cls: "bg-emerald-100 text-emerald-700" },
  { key: "can_write",  label: "Write",  cls: "bg-amber-100 text-amber-700" },
  { key: "can_delete", label: "Delete", cls: "bg-red-100 text-red-700"     },
] as const;

interface PermissionRecord {
  id:          string;
  access_type: AccessType;
  access_id:   string;
  can_read:    boolean;
  can_upload:  boolean;
  can_write:   boolean;
  can_delete:  boolean;
}

type EntityMapType = Map<string, string>;

const BLANK_PERMS = { can_read: false, can_upload: false, can_write: false, can_delete: false };

function ManageAccessModal({
  folderId, folderName, onClose, requireRead,
}: {
  folderId:    string;
  folderName:  string;
  onClose:     () => void;
  requireRead?: boolean;
}) {
  /* ── existing permissions list ── */
  const [records,     setRecords]    = useState<PermissionRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  /* ── entity maps (loaded once on mount, used for name resolution + dropdown) ── */
  const [entityMaps, setEntityMaps] = useState<Record<string, EntityMapType>>({
    USER: new Map(), GROUP: new Map(), DEPARTMENT: new Map(), FUNCTION: new Map(),
  });
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [companyId,  setCompanyId]  = useState<string | null>(null);

  /* ── close guard ── */
  const [closeWarning, setCloseWarning] = useState(false);

  function handleClose() {
    if (requireRead && !records.some((r) => r.can_read)) {
      setCloseWarning(true);
      setTimeout(() => setCloseWarning(false), 3500);
      return;
    }
    onClose();
  }

  /* ── form state (add / update) ── */
  const [accessType, setAccessType] = useState<AccessType>("USER");
  const [entityId,   setEntityId]   = useState("");
  const [perms,      setPerms]      = useState({ ...BLANK_PERMS });
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);

  /* ── load everything on mount ── */
  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setListLoading(true);
      try {
        const [meRes, permsRes, usersRes, grpsRes, deptsRes, funcsRes] = await Promise.all([
          fetch("/api/auth/me",              { credentials: "include" }),
          fetch(`/api/dms/folder-permissions?folder_id=${folderId}`, { credentials: "include" }),
          fetch("/api/admin/users",          { credentials: "include" }),
          fetch("/api/admin/groups",         { credentials: "include" }),
          fetch("/api/admin/departments",    { credentials: "include" }),
          fetch("/api/admin/functions",      { credentials: "include" }),
        ]);
        const [me, permsData, users, grps, depts, funcs] = await Promise.all([
          meRes.json(), permsRes.json(),
          usersRes.json(), grpsRes.json(), deptsRes.json(), funcsRes.json(),
        ]);
        if (cancelled) return;

        if (me?.company_id) setCompanyId(me.company_id);
        if (Array.isArray(permsData)) setRecords(permsData as PermissionRecord[]);

        const makeMap = (list: any[]): EntityMapType => {
          const m = new Map<string, string>();
          if (!Array.isArray(list)) return m;
          for (const e of list) m.set(e.id, e.name?.trim() || e.email || e.id);
          return m;
        };
        setEntityMaps({
          USER:       makeMap(users),
          GROUP:      makeMap(grps),
          DEPARTMENT: makeMap(depts),
          FUNCTION:   makeMap(funcs),
        });
        setMapsLoaded(true);
      } catch { /* swallow */ }
      finally { if (!cancelled) setListLoading(false); }
    }
    loadAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  /* ── refresh permissions list after save/delete ── */
  async function refreshRecords() {
    const res  = await fetch(`/api/dms/folder-permissions?folder_id=${folderId}`, { credentials: "include" });
    const data = await res.json();
    if (Array.isArray(data)) setRecords(data as PermissionRecord[]);
  }

  /* ── helpers ── */
  function getEntityName(type: AccessType, id: string): string {
    if (type === "COMPANY") return "Entire Company";
    return entityMaps[type]?.get(id) ?? `${id.slice(0, 8)}…`;
  }

  function isFullAccess(r: PermissionRecord) {
    return r.can_read && r.can_upload && r.can_write && r.can_delete;
  }

  function resetForm() {
    setAccessType("USER");
    setEntityId("");
    setPerms({ ...BLANK_PERMS });
    setEditingId(null);
    setError("");
    setSuccess(false);
  }

  /* ── type button click (user-initiated, not via edit) ── */
  function handleTypeChange(type: AccessType) {
    setAccessType(type);
    setEntityId("");
    setPerms({ ...BLANK_PERMS });
    setEditingId(null);
    setError("");
    setSuccess(false);
  }

  /* ── edit a record: pre-fill the form ── */
  function handleEdit(rec: PermissionRecord) {
    setAccessType(rec.access_type);
    setEntityId(rec.access_type === "COMPANY" ? "" : rec.access_id);
    setPerms({ can_read: rec.can_read, can_upload: rec.can_upload, can_write: rec.can_write, can_delete: rec.can_delete });
    setEditingId(rec.id);
    setError("");
    setSuccess(false);
  }

  /* ── remove a record ── */
  async function handleRemove(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/dms/folder-permissions?id=${id}`, { method: "DELETE", credentials: "include" });
      setRecords((prev) => prev.filter((r) => r.id !== id));
      if (editingId === id) resetForm();
    } finally {
      setDeletingId(null);
    }
  }

  /* ── save permission ── */
  async function handleSave() {
    const effectiveId = accessType === "COMPANY" ? companyId : entityId;
    if (!effectiveId) { setError("Please select an entity."); return; }

    setSaving(true); setError(""); setSuccess(false);
    try {
      const res  = await fetch("/api/dms/folder-permissions", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({
          folder_id:   folderId,
          access_type: accessType,
          access_id:   effectiveId,
          permissions: perms,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to save."); return; }
      setSuccess(true);
      await refreshRecords();
      setTimeout(() => { resetForm(); }, 1200);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const isCompany   = accessType === "COMPANY";
  const effectiveId = isCompany ? companyId : entityId;

  /* Dropdown options for the form — derived from entity maps */
  const formOptions: AccessEntity[] = (!mapsLoaded || isCompany)
    ? []
    : Array.from(entityMaps[accessType]?.entries() ?? []).map(([id, name]) => ({ id, name }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleClose}
      data-testid="modal-manage-access-backdrop"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-manage-access"
      >

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 shrink-0">
              <ShieldCheck size={16} className="text-blue-600"/>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">Manage Access</h2>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{folderName}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors shrink-0 ml-3" data-testid="btn-close-manage-access">
            <X size={15}/>
          </button>
        </div>

        {/* ── Close warning ── */}
        {closeWarning && (
          <div className="mx-6 mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2.5 rounded-lg shrink-0" data-testid="close-warning">
            <AlertCircle size={13} className="shrink-0 mt-0.5 text-amber-500"/>
            <span>Please assign at least <strong>Read</strong> permission before closing.</span>
          </div>
        )}

        {/* ── requireRead notice (always visible when no read perm yet) ── */}
        {requireRead && !listLoading && !records.some((r) => r.can_read) && (
          <div className="mx-6 mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-2.5 rounded-lg shrink-0" data-testid="require-read-notice">
            <ShieldCheck size={13} className="shrink-0 mt-0.5 text-blue-500"/>
            <span>This folder has no access yet. Assign at least <strong>Read</strong> permission so users can see it.</span>
          </div>
        )}

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 min-h-0">

          {/* ─── Section 1: Current Access ─── */}
          <div className="px-6 pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Access</span>
              {records.length > 0 && (
                <span className="text-xs text-slate-400">{records.length} {records.length === 1 ? "entry" : "entries"}</span>
              )}
            </div>

            {listLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
                <Loader2 size={13} className="animate-spin"/> Loading permissions…
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
                <ShieldCheck size={20} className="text-slate-300"/>
                <p className="text-xs text-slate-400 font-medium">No access assigned yet.</p>
              </div>
            ) : (
              <div className="space-y-2" data-testid="existing-access-list">
                {records.map((rec) => {
                  const isEditingThis = editingId === rec.id;
                  const fullAccess    = isFullAccess(rec);
                  return (
                    <div
                      key={rec.id}
                      className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border transition-colors ${
                        isEditingThis ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100 hover:border-slate-200"
                      }`}
                      data-testid={`access-row-${rec.id}`}
                    >
                      {/* Left: type badge + name + perms */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${TYPE_COLORS[rec.access_type]}`}>
                            {rec.access_type === "DEPARTMENT" ? "DEPT" : rec.access_type === "FUNCTION" ? "FUNC" : rec.access_type}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 truncate">
                            {getEntityName(rec.access_type, rec.access_id)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {fullAccess ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                              Full Access
                            </span>
                          ) : (
                            PERM_BADGES.filter((b) => rec[b.key]).map((b) => (
                              <span key={b.key} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${b.cls}`}>
                                {b.label}
                              </span>
                            ))
                          )}
                          {!fullAccess && !PERM_BADGES.some((b) => rec[b.key]) && (
                            <span className="text-[10px] text-slate-400 italic">No permissions</span>
                          )}
                        </div>
                      </div>

                      {/* Right: action buttons */}
                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        <button
                          onClick={() => handleEdit(rec)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isEditingThis
                              ? "bg-blue-200 text-blue-700"
                              : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          }`}
                          title="Edit permissions"
                          data-testid={`btn-edit-access-${rec.id}`}
                        >
                          <Pencil size={13}/>
                        </button>
                        <button
                          onClick={() => handleRemove(rec.id)}
                          disabled={deletingId === rec.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Remove access"
                          data-testid={`btn-remove-access-${rec.id}`}
                        >
                          {deletingId === rec.id
                            ? <Loader2 size={13} className="animate-spin"/>
                            : <Trash2 size={13}/>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── Divider ─── */}
          <div className="mx-6 border-t border-slate-100"/>

          {/* ─── Section 2: Add / Update Access ─── */}
          <div className="px-6 pt-4 pb-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Plus size={11}/> {editingId ? "Update Access" : "Add Access"}
              </span>
              {editingId && (
                <button onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors" data-testid="btn-cancel-edit">
                  <X size={11}/> Cancel edit
                </button>
              )}
            </div>

            {/* Type selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Type</label>
              <div className="flex gap-1.5 flex-wrap">
                {ACCESS_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleTypeChange(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      accessType === opt.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                    }`}
                    data-testid={`btn-type-${opt.value.toLowerCase()}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Entity selector */}
            {!isCompany && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Entity</label>
                {!mapsLoaded ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                    <Loader2 size={13} className="animate-spin"/> Loading…
                  </div>
                ) : (
                  <select
                    value={entityId}
                    onChange={(e) => { setEntityId(e.target.value); setError(""); }}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
                    data-testid="select-entity"
                  >
                    <option value="">— Select {ACCESS_TYPE_OPTIONS.find(o => o.value === accessType)?.label} —</option>
                    {formOptions.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {isCompany && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <Users size={14} className="text-indigo-500 shrink-0"/>
                <span className="text-sm text-indigo-700 font-medium">Permission applies to entire company</span>
              </div>
            )}

            {/* Permission checkboxes */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2.5">Permissions</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "can_read",   label: "Read"   },
                  { key: "can_upload", label: "Upload" },
                  { key: "can_write",  label: "Write"  },
                  { key: "can_delete", label: "Delete" },
                ] as { key: keyof typeof perms; label: string }[]).map(({ key, label }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors select-none ${
                      perms[key]
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                    data-testid={`chk-${key}`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      perms[key] ? "bg-blue-600 border-blue-600" : "border-slate-300"
                    }`}>
                      {perms[key] && <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <input type="checkbox" className="sr-only" checked={perms[key]} onChange={() => setPerms((p) => ({ ...p, [key]: !p[key] }))}/>
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Messages */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5" data-testid="msg-manage-access-error">
                <AlertCircle size={13}/> {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5" data-testid="msg-manage-access-success">
                <CheckCircle2 size={13}/> Permissions saved successfully.
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors" data-testid="btn-cancel-manage-access">
                Close
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !effectiveId}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="btn-save-manage-access"
              >
                {saving ? <Loader2 size={14} className="animate-spin"/> : <ShieldCheck size={14}/>}
                {saving ? "Saving…" : editingId ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Rename Modal ───────────────────────────────────────────────────────── */

function RenameModal({
  current, kind, onClose, onRenamed,
}: {
  current:   { id: string; name: string };
  kind:      "folder" | "file";
  onClose:   () => void;
  onRenamed: (newName: string) => void;
}) {
  const [name,    setName]    = useState(current.name);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleSave() {
    if (!name.trim() || name.trim() === current.name) { onClose(); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/dms/rename", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, type: kind, new_name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Rename failed."); return; }
      onRenamed(name.trim());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()} data-testid="modal-rename">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Rename {kind}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><X size={15}/></button>
        </div>
        <input
          type="text" value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus data-testid="input-rename"
        />
        {error && <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={12}/> {error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            data-testid="btn-rename-save"
          >
            {loading ? <Loader2 size={14} className="animate-spin"/> : <Pencil size={14}/>} Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Delete Confirm Modal ───────────────────────────────────────────────── */

function DeleteModal({
  target, kind, onClose, onDeleted,
}: {
  target:    { id: string; name: string };
  kind:      "folder" | "file";
  onClose:   () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleDelete() {
    setLoading(true); setError("");
    const url = kind === "folder"
      ? `/api/dms/folder?folder_id=${target.id}`
      : `/api/dms/file?file_id=${target.id}`;
    try {
      const res  = await fetch(url, { method: "DELETE", credentials: "include" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Delete failed."); return; }
      onDeleted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()} data-testid="modal-delete">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Delete {kind}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><X size={15}/></button>
        </div>
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <span className="font-semibold text-slate-800">"{target.name}"</span>?
          {kind === "folder" && " All files inside will also be deleted."}
          {" This cannot be undone."}
        </p>
        {error && <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={12}/> {error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleDelete} disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
            data-testid="btn-delete-confirm"
          >
            {loading ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Activity Log Modal ─────────────────────────────────────────────────── */

interface ActivityEntry {
  id:          string;
  user:        string;
  action:      string;
  entity_type: string;
  entity_name: string;
  created_at:  string;
  details:     { old_name?: string; new_name?: string } | null;
}

function formatAction(entry: ActivityEntry): string {
  switch (entry.action) {
    case "CREATE_FOLDER": return `created folder "${entry.entity_name}"`;
    case "UPLOAD_FILE":   return `uploaded "${entry.entity_name}"`;
    case "DELETE":        return `deleted ${entry.entity_type} "${entry.entity_name}"`;
    case "RENAME":
      return entry.details?.old_name
        ? `renamed "${entry.details.old_name}" → "${entry.details.new_name ?? entry.entity_name}"`
        : `renamed to "${entry.entity_name}"`;
    case "DOWNLOAD":      return `downloaded "${entry.entity_name}"`;
    default:              return `${entry.action.toLowerCase()} "${entry.entity_name}"`;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ActivityModal({
  target,
  onClose,
}: {
  target:  { id: string; name: string; kind: "folder" | "file" };
  onClose: () => void;
}) {
  const [logs,    setLogs]    = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(
          `/api/dms/activity?entity_id=${target.id}&limit=20`,
          { credentials: "include" },
        );
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Failed to load activity."); return; }
        setLogs(json);
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [target.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate-500"/>
            <h2 className="text-base font-bold text-slate-900">Activity Log</h2>
          </div>
          <p className="text-xs text-slate-400 mr-2 truncate max-w-[160px]">{target.name}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <X size={15}/>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-1">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-slate-400"/>
            </div>
          )}
          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1.5 py-4 justify-center">
              <AlertCircle size={12}/> {error}
            </p>
          )}
          {!loading && !error && logs.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No activity recorded yet.</p>
          )}
          {!loading && logs.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-blue-600">
                  {entry.user.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-700">
                  <span className="font-semibold">{entry.user}</span>{" "}
                  {formatAction(entry)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{timeAgo(entry.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── File Preview Modal ─────────────────────────────────────────────────── */

function FilePreviewModal({ file, onClose }: { file: DmsFile; onClose: () => void }) {
  const kind = classifyFile(file.name);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
      data-testid="modal-file-preview-backdrop"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-file-preview"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText size={17} className="text-blue-500 shrink-0"/>
            <span className="font-semibold text-slate-800 truncate text-sm" data-testid="text-preview-filename">{file.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <a href={proxyUrl(file.id, true)} download={file.name}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              data-testid="btn-modal-download"
            >
              <Download size={13}/> Download
            </a>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" data-testid="btn-close-preview">
              <X size={16}/>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 min-h-0">
          {kind === "pdf" && (
            <iframe src={proxyUrl(file.id)} title={file.name} className="w-full h-full min-h-[70vh]" data-testid="iframe-pdf-preview"/>
          )}
          {kind === "image" && (
            <div className="flex items-center justify-center p-6 h-full min-h-[60vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proxyUrl(file.id)} alt={file.name} className="max-w-full max-h-[75vh] rounded-lg object-contain shadow" data-testid="img-file-preview"/>
            </div>
          )}
          {kind === "unsupported" && (
            <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
              <div className="p-4 bg-slate-100 rounded-full"><FileX size={32} className="text-slate-400"/></div>
              <div>
                <p className="text-slate-700 font-medium text-sm">This file cannot be previewed. Please download.</p>
                <p className="text-slate-400 text-xs mt-1">{file.name}</p>
              </div>
              <a href={proxyUrl(file.id, true)} download={file.name}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                data-testid="btn-unsupported-download"
              >
                <Download size={15}/> Download
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── New Folder Modal ───────────────────────────────────────────────────── */

function NewFolderModal({
  parentId, isRootLevel, onClose, onCreated,
}: {
  parentId?:    string;
  isRootLevel?: boolean;
  onClose:      () => void;
  onCreated:    (folder: DmsFolder) => void;
}) {
  const [name, setName]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleCreate() {
    if (!name.trim()) { setError("Folder name is required."); return; }
    setLoading(true); setError("");
    try {
      const body = isRootLevel
        ? { name: name.trim(), type: "TEAM" }
        : { name: name.trim(), parent_id: parentId };
      const res  = await fetch("/api/dms/folders", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to create folder."); return; }
      onCreated(json as DmsFolder);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">New Folder</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><X size={15}/></button>
        </div>
        <input
          type="text" placeholder="Folder name" value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus data-testid="input-folder-name"
        />
        {error && <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={12}/> {error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleCreate} disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            data-testid="btn-create-folder-confirm"
          >
            {loading ? <Loader2 size={14} className="animate-spin"/> : <FolderPlus size={14}/>} Create
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function DmsTeamFolderPage() {
  /* ── navigation state ── */
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolder,   setCurrentFolder]   = useState<DmsFolder | null>(null);
  const [breadcrumbs,     setBreadcrumbs]     = useState<BreadcrumbEntry[]>([]);

  /* ── current user ── */
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((me) => { if (me?.role) setCurrentUserRole(me.role); })
      .catch(() => {});
  }, []);

  /* ── content state ── */
  const [topLevelFolders, setTopLevelFolders] = useState<DmsFolder[]>([]);
  const [folders,  setFolders]  = useState<DmsFolder[]>([]);
  const [files,    setFiles]    = useState<DmsFile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  /* ── upload state ── */
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadDone,  setUploadDone]  = useState(false);
  const [isDragging,  setIsDragging]  = useState(false);

  /* ── modal/menu state ── */
  const [viewMode,           setViewMode]           = useState<ViewMode>("list");
  const [previewFile,        setPreviewFile]        = useState<DmsFile | null>(null);
  const [ctxMenu,            setCtxMenu]            = useState<CtxMenu | null>(null);
  const [rootCtxMenu,        setRootCtxMenu]        = useState<{ x: number; y: number } | null>(null);
  const [renameTarget,       setRenameTarget]       = useState<{ id: string; name: string; kind: "folder" | "file" } | null>(null);
  const [deleteTarget,       setDeleteTarget]       = useState<{ id: string; name: string; kind: "folder" | "file" } | null>(null);
  const [activityTarget,     setActivityTarget]     = useState<{ id: string; name: string; kind: "folder" | "file" } | null>(null);
  const [showNewFolder,      setShowNewFolder]      = useState(false);
  const [newFolderIsRoot,    setNewFolderIsRoot]    = useState(false);
  const [newFolderParentId,  setNewFolderParentId]  = useState<string | null>(null);
  const [manageAccessTarget, setManageAccessTarget] = useState<{ id: string; name: string; requireRead?: boolean } | null>(null);
  const [rowPerms,           setRowPerms]           = useState<Record<string, FolderAccess>>({});

  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [selectedKind, setSelectedKind] = useState<Record<string, "folder" | "file">>({});
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError,    setBulkError]    = useState("");
  const [isZipping,    setIsZipping]    = useState(false);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const uploadFolderRef = useRef<string | null>(null);
  const accessCache     = useRef<Map<string, FolderAccess>>(new Map());
  const dblClickTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── load top-level team folders (root) ── */
  const loadTopLevel = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/dms/team-folders", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to load team folders."); return; }
      const list: DmsFolder[] = Array.isArray(data) ? data : [];
      setTopLevelFolders(list);
      setFolders(list);
      setFiles([]);
    } catch {
      setError("Failed to load team folders.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── load contents — single fetch returns { currentFolder, breadcrumbs, folders, files } ── */
  const loadContents = useCallback(async (folderId: string) => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/dms/folders?parent_id=${folderId}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to load contents."); return; }
      const { currentFolder: cf, breadcrumbs: bc, folders: fds, files: fis } = data;
      setCurrentFolder(cf ?? null);
      setBreadcrumbs(Array.isArray(bc) ? bc : []);
      setFolders(Array.isArray(fds) ? fds : []);
      setFiles(Array.isArray(fis)   ? fis : []);
    } catch {
      setError("Failed to load contents.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── currentFolderId drives which view to show ── */
  useEffect(() => {
    if (currentFolderId === null) {
      loadTopLevel();
    } else {
      loadContents(currentFolderId);
    }
  }, [currentFolderId, loadTopLevel, loadContents]);

  /* ── batch-fetch permissions for list-view Delete buttons ── */
  useEffect(() => {
    if (loading) return;
    const ids = new Set<string>([
      ...(currentFolder ? [currentFolder.id] : []),
      ...folders.map((f) => f.id),
    ]);
    if (ids.size === 0) return;

    const fetchAll = async () => {
      const results: Record<string, FolderAccess> = {};
      await Promise.all(
        [...ids].map(async (id) => {
          let access = accessCache.current.get(id);
          if (!access) {
            try {
              const res = await fetch(`/api/dms/folder-access?folder_id=${id}`, { credentials: "include" });
              if (!res.ok) return;
              access = await res.json() as FolderAccess;
              accessCache.current.set(id, access);
            } catch { return; }
          }
          results[id] = access;
        }),
      );
      setRowPerms(results);
    };
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders, files, currentFolder, loading]);

  /* ── selection helpers ── */
  function clearSelection() {
    setSelectedIds(new Set());
    setSelectedKind({});
    setBulkError("");
  }

  function toggleSelect(id: string, kind: "folder" | "file", e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSelectedKind((prev) => ({ ...prev, [id]: kind }));
  }

  function handleSelectAll(
    visibleFolderIds: string[],
    visibleFileIds: string[],
    allSelected: boolean,
  ) {
    if (allSelected) {
      clearSelection();
    } else {
      const kinds: Record<string, "folder" | "file"> = {};
      visibleFolderIds.forEach((id) => (kinds[id] = "folder"));
      visibleFileIds.forEach((id)   => (kinds[id] = "file"));
      setSelectedIds(new Set([...visibleFolderIds, ...visibleFileIds]));
      setSelectedKind(kinds);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true); setBulkError("");
    const errors: string[] = [];
    for (const id of selectedIds) {
      const kind = selectedKind[id];
      const url  = kind === "folder" ? `/api/dms/folders/${id}` : `/api/dms/files/${id}`;
      try {
        const res = await fetch(url, { method: "DELETE", credentials: "include" });
        if (!res.ok) {
          const j = await res.json().catch(() => ({})) as { error?: string };
          errors.push(j.error ?? `Failed to delete ${kind}`);
        }
      } catch { errors.push(`Network error deleting ${kind}`); }
    }
    setBulkDeleting(false);
    clearSelection();
    if (errors.length > 0) setBulkError(errors.join("; "));
    if (currentFolderId) loadContents(currentFolderId); else loadTopLevel();
  }

  async function handleDownloadSelected() {
    if (selectedIds.size === 0 || isZipping) return;
    setIsZipping(true);
    try {
      const ids  = Array.from(selectedIds);
      const type = ids.every((id) => selectedKind[id] === "file")
        ? "file"
        : ids.every((id) => selectedKind[id] === "folder")
        ? "folder"
        : "mixed";

      const res = await fetch("/api/dms/download-zip", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ ids, type }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        setBulkError(j.error ?? "Failed to prepare download.");
        return;
      }

      const blob    = await res.blob();
      const url     = URL.createObjectURL(blob);
      const anchor  = document.createElement("a");
      anchor.href   = url;
      anchor.download = "download.zip";
      anchor.click();
      URL.revokeObjectURL(url);
      clearSelection();
    } catch {
      setBulkError("Network error. Please try again.");
    } finally {
      setIsZipping(false);
    }
  }

  /* ── navigation ── */
  function openFolder(folder: DmsFolder) {
    clearSelection();
    setCurrentFolderId(folder.id);
  }

  function navigateToRoot() {
    clearSelection();
    setCurrentFolderId(null);
    setCurrentFolder(null);
    setBreadcrumbs([]);
    accessCache.current.clear();
  }

  function navigateToCrumb(entry: BreadcrumbEntry) {
    clearSelection();
    setCurrentFolderId(entry.id);
  }

  function handleFolderDoubleClick(folder: DmsFolder) {
    if (dblClickTimer.current) clearTimeout(dblClickTimer.current);
    openFolder(folder);
  }

  /* ── upload ── */
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    const targetId = uploadFolderRef.current ?? currentFolder?.id;
    if (!selected || selected.length === 0 || !targetId) return;

    setUploading(true); setUploadError(""); setUploadDone(false);
    const form = new FormData();
    form.append("folder_id", targetId);
    for (const file of Array.from(selected)) form.append("file", file);

    try {
      const res  = await fetch("/api/dms/upload", { method: "POST", credentials: "include", body: form });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error ?? "Upload failed."); return; }
      setUploadDone(true);
      setTimeout(() => setUploadDone(false), 3000);
      if (currentFolderId) loadContents(currentFolderId);
    } catch {
      setUploadError("Network error. Please try again.");
    } finally {
      setUploading(false);
      uploadFolderRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /* ── drag-and-drop upload ── */
  async function handleDropUpload(files: File[]) {
    const targetId = currentFolder?.id;
    if (!files.length || !targetId) return;

    setUploading(true); setUploadError(""); setUploadDone(false);
    const form = new FormData();
    form.append("folder_id", targetId);
    for (const file of files) form.append("file", file);

    try {
      const res  = await fetch("/api/dms/upload", { method: "POST", credentials: "include", body: form });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error ?? "Upload failed."); return; }
      setUploadDone(true);
      setTimeout(() => setUploadDone(false), 3000);
      if (currentFolderId) loadContents(currentFolderId);
    } catch {
      setUploadError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (currentFolder) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (!currentFolder) return;
    const files = Array.from(e.dataTransfer.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length) void handleDropUpload(files);
  }

  /* ── right-click / context menu ── */
  async function handleContextMenu(
    e: React.MouseEvent,
    item: DmsFolder | DmsFile,
    kind: "folder" | "file",
  ) {
    e.preventDefault();
    const folder_id = kind === "folder" ? (item as DmsFolder).id : currentFolder?.id ?? "";
    if (!folder_id) return;

    /* Admin always gets full access — skip DB lookup */
    let access: FolderAccess;
    if (isAdmin) {
      access = { can_read: true, can_upload: true, can_write: true, can_delete: true };
    } else {
      let cached = accessCache.current.get(folder_id);
      if (!cached) {
        try {
          const res = await fetch(`/api/dms/folder-access?folder_id=${folder_id}`, { credentials: "include" });
          cached = await res.json() as FolderAccess;
          accessCache.current.set(folder_id, cached);
        } catch { return; }
      }
      access = cached;
    }

    /* Manage Access: always for admin on any folder; otherwise root TEAM folders only */
    const canManageAccess =
      kind === "folder" && (isAdmin || (item as DmsFolder).type === "TEAM");

    setCtxMenu({ x: e.clientX, y: e.clientY, item, kind, access, canManageAccess });
  }

  /* ── context menu actions ── */
  function ctxView() {
    if (!ctxMenu) return;
    if (ctxMenu.kind === "folder") openFolder(ctxMenu.item as DmsFolder);
    else setPreviewFile(ctxMenu.item as DmsFile);
  }

  function ctxUpload() {
    if (!ctxMenu || ctxMenu.kind !== "folder") return;
    uploadFolderRef.current = (ctxMenu.item as DmsFolder).id;
    fileInputRef.current?.click();
  }

  function ctxRename() {
    if (!ctxMenu) return;
    setRenameTarget({ id: ctxMenu.item.id, name: ctxMenu.item.name, kind: ctxMenu.kind });
  }

  function ctxDelete() {
    if (!ctxMenu) return;
    setDeleteTarget({ id: ctxMenu.item.id, name: ctxMenu.item.name, kind: ctxMenu.kind });
  }

  function ctxActivity() {
    if (!ctxMenu) return;
    setActivityTarget({ id: ctxMenu.item.id, name: ctxMenu.item.name, kind: ctxMenu.kind });
  }

  function ctxNewFolder() {
    if (!ctxMenu || ctxMenu.kind !== "folder") return;
    setNewFolderParentId((ctxMenu.item as DmsFolder).id);
    setNewFolderIsRoot(false);
    setShowNewFolder(true);
  }

  function ctxManageAccess() {
    if (!ctxMenu || ctxMenu.kind !== "folder") return;
    setManageAccessTarget({ id: ctxMenu.item.id, name: ctxMenu.item.name });
  }

  /* ── root-level right-click (admin only) ── */
  function handleRootContextMenu(e: React.MouseEvent<HTMLDivElement>) {
    if (!isAdmin || !isAtRoot) return;
    e.preventDefault();
    setRootCtxMenu({ x: e.clientX, y: e.clientY });
  }

  /* ── after rename ── */
  function applyRename(newName: string) {
    if (!renameTarget) return;
    if (renameTarget.kind === "folder") {
      setFolders((prev) => prev.map((f) => f.id === renameTarget.id ? { ...f, name: newName } : f));
    } else {
      setFiles((prev) => prev.map((f) => f.id === renameTarget.id ? { ...f, name: newName } : f));
    }
    accessCache.current.delete(renameTarget.id);
    setRenameTarget(null);
  }

  /* ── after delete ── */
  function applyDelete() {
    if (!deleteTarget) return;
    accessCache.current.delete(deleteTarget.id);
    setDeleteTarget(null);
    if (currentFolder === null) loadTopLevel();
    else if (currentFolderId) loadContents(currentFolderId);
  }

  /* ── derived ── */
  const isAtRoot     = currentFolderId === null;
  const isAdmin      = currentUserRole === "ADMIN";
  const canUpload    = !isAtRoot && (isAdmin || (rowPerms[currentFolder?.id ?? ""]?.can_upload ?? false));
  const canNewFolder = !isAtRoot && (isAdmin || (rowPerms[currentFolder?.id ?? ""]?.can_upload ?? false));
  const totalItems   = folders.length + files.length;

  /* ── selection derived values ── */
  const visibleFolderIds = folders
    .filter((f) => rowPerms[f.id]?.can_read !== false)
    .map((f) => f.id);
  const visibleFileIds =
    rowPerms[currentFolder?.id ?? ""]?.can_read !== false ? files.map((f) => f.id) : [];
  const visibleItemCount = visibleFolderIds.length + visibleFileIds.length;
  const allSelected =
    visibleItemCount > 0 &&
    visibleFolderIds.every((id) => selectedIds.has(id)) &&
    visibleFileIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  /* ─────────────────────────────────────────────────────────────────── */

  return (
    <div
      className="space-y-6 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Drag-and-drop overlay ── */}
      {isDragging && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-blue-400 bg-blue-50/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-blue-600">
            <Upload size={36} strokeWidth={1.5}/>
            <p className="text-base font-semibold">Drop files here to upload</p>
            <p className="text-xs text-blue-400">Files will be added to the current folder</p>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Folder</h1>
          <p className="text-sm text-slate-500 mt-0.5">Shared team document storage</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden text-xs font-semibold">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${viewMode === "list" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
              data-testid="btn-view-list"
            >
              <List size={13}/> List
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${viewMode === "grid" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
              data-testid="btn-view-grid"
            >
              <LayoutGrid size={13}/> Grid
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={() => isAtRoot ? loadTopLevel() : currentFolderId && loadContents(currentFolderId)}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh"
            data-testid="btn-refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""}/>
          </button>

          {/* New Folder — only shown inside a folder with upload permission */}
          {canNewFolder && (
            <button
              onClick={() => { setNewFolderParentId(currentFolder?.id ?? null); setNewFolderIsRoot(false); setShowNewFolder(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              data-testid="btn-new-folder"
            >
              <FolderPlus size={15}/> New Folder
            </button>
          )}

          {/* New Team Folder — admin only, shown at root */}
          {isAdmin && isAtRoot && (
            <button
              onClick={() => { setNewFolderIsRoot(true); setNewFolderParentId(null); setShowNewFolder(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-50 transition-colors"
              data-testid="btn-new-team-folder"
            >
              <FolderPlus size={15}/> New Team Folder
            </button>
          )}

          {/* Upload — only shown inside a folder with upload permission */}
          {canUpload && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
              data-testid="btn-upload"
            >
              {uploading ? <Loader2 size={15} className="animate-spin"/> : <Upload size={15}/>}
              {uploading ? "Uploading…" : "Upload"}
            </button>
          )}

          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} data-testid="input-file-upload"/>
        </div>
      </div>

      {/* ── Banners ── */}
      {uploadError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertCircle size={15}/> {uploadError}
          <button onClick={() => setUploadError("")} className="ml-auto"><X size={14}/></button>
        </div>
      )}
      {uploadDone && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
          Files uploaded successfully.
        </div>
      )}

      {/* ── Bulk error ── */}
      {bulkError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertCircle size={15}/> {bulkError}
          <button onClick={() => setBulkError("")} className="ml-auto"><X size={14}/></button>
        </div>
      )}

      {/* ── Selection action bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-md flex-wrap" data-testid="selection-bar">
          <span className="text-sm font-semibold">{selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""} selected</span>
          <button
            onClick={clearSelection}
            className="ml-1 text-slate-400 hover:text-white transition-colors"
            title="Clear selection"
            data-testid="btn-clear-selection"
          >
            <X size={15}/>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleDownloadSelected}
              disabled={isZipping}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="btn-download-selected"
            >
              {isZipping
                ? <><Loader2 size={14} className="animate-spin"/> Preparing…</>
                : <><Download size={14}/> Download as ZIP</>
              }
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
              data-testid="btn-delete-selected"
            >
              {bulkDeleting ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}
              {bulkDeleting ? "Deleting…" : "Delete Selected"}
            </button>
          </div>
        </div>
      )}

      {/* ── Breadcrumbs ── */}
      <nav className="flex items-center gap-1.5 flex-wrap text-sm" aria-label="breadcrumb" data-testid="breadcrumb-nav">
        <Link href="/dashboard" className="text-blue-600 hover:underline font-medium" data-testid="breadcrumb-home">
          Home
        </Link>
        <span className="text-slate-300 select-none font-light">/</span>
        <button
          onClick={navigateToRoot}
          className={`font-medium transition-colors ${isAtRoot ? "text-slate-700 font-semibold cursor-default" : "text-blue-600 hover:underline"}`}
          data-testid="breadcrumb-team-folder"
        >
          Team Folder
        </button>
        {breadcrumbs.map((crumb, idx) => (
          <span key={crumb.id} className="flex items-center gap-1.5">
            <span className="text-slate-300 select-none font-light">/</span>
            {idx < breadcrumbs.length - 1 ? (
              <button
                onClick={() => navigateToCrumb(crumb)}
                className="text-blue-600 hover:underline font-medium"
                data-testid={`breadcrumb-${idx}`}
              >
                {crumb.name}
              </button>
            ) : (
              <span className="font-semibold text-slate-700" data-testid="breadcrumb-current">
                {crumb.name}
              </span>
            )}
          </span>
        ))}
      </nav>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertCircle size={15}/> {error}
        </div>
      )}

      {/* ── Content area (right-clickable at root for admin) ── */}
      <div onContextMenu={handleRootContextMenu} className="min-h-[200px]">

      {/* ── Loading skeleton ── */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-3">
          {[1,2,3,4].map((i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse"/>)}
        </div>

      /* ── Empty state ── */
      ) : totalItems === 0 && !error ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
          <div className="p-4 bg-slate-50 rounded-full mb-4"><Users size={32} className="text-slate-400"/></div>
          <p className="text-slate-700 font-medium">
            {isAtRoot ? (isAdmin ? "No team folders yet" : "No team folders are shared with you") : "This folder is empty"}
          </p>
          <p className="text-slate-400 text-sm mt-1">
            {isAtRoot
              ? (isAdmin
                  ? "Right-click here or click the button below to create a new team folder."
                  : "Contact your administrator to be granted access.")
              : canUpload ? "Upload files or create a sub-folder to get started." : "No files here yet."}
          </p>
          {isAtRoot && isAdmin && (
            <button
              onClick={() => { setNewFolderIsRoot(true); setNewFolderParentId(null); setShowNewFolder(true); }}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              data-testid="btn-create-team-folder-empty"
            >
              <FolderPlus size={14}/> New Team Folder
            </button>
          )}
          {!isAtRoot && canUpload && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              data-testid="btn-upload-empty"
            >
              <Upload size={14}/> Upload Files
            </button>
          )}
        </div>

      /* ── Grid view ── */
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" data-testid="grid-view">
          {folders.filter((f) => rowPerms[f.id]?.can_read !== false).map((folder) => (
            <div
              key={folder.id}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-yellow-300 transition-all cursor-pointer select-none group"
              onDoubleClick={() => handleFolderDoubleClick(folder)}
              onContextMenu={(e) => handleContextMenu(e, folder, "folder")}
              title="Double-click to open • Right-click for options"
              data-testid={`card-folder-${folder.id}`}
            >
              <div className="p-3 bg-yellow-50 rounded-xl group-hover:bg-yellow-100 transition-colors">
                <Folder size={28} className="text-yellow-500"/>
              </div>
              <span className="text-xs font-semibold text-slate-700 text-center truncate w-full">{folder.name}</span>
              <span className="text-[10px] text-slate-400">{folder.created_at ? fmtDate(folder.created_at) : "—"}</span>
            </div>
          ))}
          {rowPerms[currentFolder?.id ?? ""]?.can_read !== false && files.map((file) => (
            <div
              key={file.id}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer select-none group"
              onDoubleClick={() => setPreviewFile(file)}
              onContextMenu={(e) => handleContextMenu(e, file, "file")}
              title="Double-click to preview • Right-click for options"
              data-testid={`card-file-${file.id}`}
            >
              <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                <FileText size={28} className="text-blue-400"/>
              </div>
              <span className="text-xs font-semibold text-slate-700 text-center truncate w-full">{file.name}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">
                {getFileExt(file.name) || "file"}
              </span>
            </div>
          ))}
        </div>

      /* ── List view ── */
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" data-testid="list-view">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-3 py-3.5 w-10">
                    <button
                      onClick={() => handleSelectAll(visibleFolderIds, visibleFileIds, allSelected)}
                      className="flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
                      title={allSelected ? "Deselect all" : "Select all"}
                      data-testid="btn-select-all"
                    >
                      {allSelected ? <CheckSquare2 size={16} className="text-blue-600"/> : someSelected ? <CheckSquare2 size={16} className="text-blue-400"/> : <Square size={16}/>}
                    </button>
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">

                {folders.filter((f) => rowPerms[f.id]?.can_read !== false).map((folder) => (
                  <tr
                    key={folder.id}
                    className={`hover:bg-slate-50 transition-colors ${selectedIds.has(folder.id) ? "bg-blue-50" : ""}`}
                    onDoubleClick={() => handleFolderDoubleClick(folder)}
                    onContextMenu={(e) => handleContextMenu(e, folder, "folder")}
                    data-testid={`row-folder-${folder.id}`}
                  >
                    <td className="px-3 py-4 w-10">
                      <button
                        onClick={(e) => toggleSelect(folder.id, "folder", e)}
                        className="flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
                        data-testid={`chk-folder-${folder.id}`}
                      >
                        {selectedIds.has(folder.id) ? <CheckSquare2 size={16} className="text-blue-600"/> : <Square size={16}/>}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <Folder size={16} className="text-yellow-500 shrink-0"/>
                        <span className="font-medium text-slate-800">{folder.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Folder</span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{folder.created_at ? fmtDate(folder.created_at) : "—"}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {rowPerms[folder.id]?.can_read !== false && (
                          <button
                            onClick={() => openFolder(folder)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                            data-testid={`btn-open-folder-${folder.id}`}
                          >
                            <FolderOpen size={12}/> Open
                          </button>
                        )}
                        {folder.type === "TEAM" && (
                          <button
                            onClick={() => setManageAccessTarget({ id: folder.id, name: folder.name })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-blue-200 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors"
                            title="Manage folder access"
                            data-testid={`btn-manage-access-${folder.id}`}
                          >
                            <ShieldCheck size={12}/>
                          </button>
                        )}
                        {rowPerms[folder.id]?.can_write && (
                          <button
                            onClick={() => setRenameTarget({ id: folder.id, name: folder.name, kind: "folder" })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                            title="Rename folder"
                            data-testid={`btn-rename-folder-${folder.id}`}
                          >
                            <Pencil size={12}/>
                          </button>
                        )}
                        {rowPerms[folder.id]?.can_delete && (
                          <button
                            onClick={() => setDeleteTarget({ id: folder.id, name: folder.name, kind: "folder" })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete folder"
                            data-testid={`btn-delete-folder-${folder.id}`}
                          >
                            <Trash2 size={12}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {rowPerms[currentFolder?.id ?? ""]?.can_read !== false && files.map((file) => (
                  <tr
                    key={file.id}
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedIds.has(file.id) ? "bg-blue-50" : ""}`}
                    onClick={() => setPreviewFile(file)}
                    onContextMenu={(e) => handleContextMenu(e, file, "file")}
                    data-testid={`row-file-${file.id}`}
                  >
                    <td className="px-3 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => toggleSelect(file.id, "file", e)}
                        className="flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
                        data-testid={`chk-file-${file.id}`}
                      >
                        {selectedIds.has(file.id) ? <CheckSquare2 size={16} className="text-blue-600"/> : <Square size={16}/>}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <FileText size={16} className="text-blue-400 shrink-0"/>
                        <span className="font-medium text-slate-800 truncate max-w-xs hover:text-blue-600 transition-colors">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 uppercase">
                        {getFileExt(file.name) || "File"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{fmtDate(file.created_at)}</td>
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                          data-testid={`btn-preview-file-${file.id}`}
                        >
                          <Eye size={12}/> Preview
                        </button>
                        <a
                          href={proxyUrl(file.id, true)}
                          download={file.name}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors"
                          data-testid={`btn-download-file-${file.id}`}
                        >
                          <Download size={12}/> Download
                        </a>
                        {rowPerms[currentFolder?.id ?? ""]?.can_write && (
                          <button
                            onClick={() => setRenameTarget({ id: file.id, name: file.name, kind: "file" })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                            title="Rename file"
                            data-testid={`btn-rename-file-${file.id}`}
                          >
                            <Pencil size={12}/>
                          </button>
                        )}
                        {rowPerms[currentFolder?.id ?? ""]?.can_delete && (
                          <button
                            onClick={() => setDeleteTarget({ id: file.id, name: file.name, kind: "file" })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete file"
                            data-testid={`btn-delete-file-${file.id}`}
                          >
                            <Trash2 size={12}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

              </tbody>
            </table>
          </div>
        </div>
      )}

      </div>{/* end content area */}

      {/* ── Context Menu ── */}
      {ctxMenu && (
        <ContextMenuPopup
          menu={ctxMenu}
          onView={ctxView}
          onUpload={ctxUpload}
          onNewFolder={ctxNewFolder}
          onRename={ctxRename}
          onActivity={ctxActivity}
          onDelete={ctxDelete}
          onManageAccess={ctxManageAccess}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* ── Root context menu (admin + isAtRoot) ── */}
      {rootCtxMenu && (
        <RootContextMenuPopup
          x={rootCtxMenu.x}
          y={rootCtxMenu.y}
          onNewFolder={() => {
            setRootCtxMenu(null);
            setNewFolderIsRoot(true);
            setNewFolderParentId(null);
            setShowNewFolder(true);
          }}
          onClose={() => setRootCtxMenu(null)}
        />
      )}

      {/* ── Rename Modal ── */}
      {renameTarget && (
        <RenameModal
          current={{ id: renameTarget.id, name: renameTarget.name }}
          kind={renameTarget.kind}
          onClose={() => setRenameTarget(null)}
          onRenamed={applyRename}
        />
      )}

      {/* ── Delete Modal ── */}
      {deleteTarget && (
        <DeleteModal
          target={deleteTarget}
          kind={deleteTarget.kind}
          onClose={() => setDeleteTarget(null)}
          onDeleted={applyDelete}
        />
      )}

      {/* ── Activity Log Modal ── */}
      {activityTarget && (
        <ActivityModal
          target={activityTarget}
          onClose={() => setActivityTarget(null)}
        />
      )}

      {/* ── File Preview Modal ── */}
      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)}/>
      )}

      {/* ── New Folder Modal ── */}
      {showNewFolder && (newFolderIsRoot || newFolderParentId) && (
        <NewFolderModal
          parentId={newFolderParentId ?? undefined}
          isRootLevel={newFolderIsRoot}
          onClose={() => { setShowNewFolder(false); setNewFolderParentId(null); setNewFolderIsRoot(false); }}
          onCreated={(folder) => {
            setShowNewFolder(false);
            setNewFolderParentId(null);
            setNewFolderIsRoot(false);
            if (newFolderIsRoot) {
              /* Root-level TEAM folder created — refresh top-level list and open permissions */
              loadTopLevel();
              setManageAccessTarget({ id: folder.id, name: folder.name, requireRead: true });
            } else {
              setFolders((prev) => [...prev, folder]);
            }
          }}
        />
      )}

      {/* ── Manage Access Modal ── */}
      {manageAccessTarget && (
        <ManageAccessModal
          folderId={manageAccessTarget.id}
          folderName={manageAccessTarget.name}
          requireRead={manageAccessTarget.requireRead}
          onClose={() => setManageAccessTarget(null)}
        />
      )}

    </div>
  );
}

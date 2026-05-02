"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Upload, FolderPlus, RefreshCw, AlertCircle,
  Folder, FileText, Download, FolderOpen,
  X, Loader2, HardDrive, Eye,
  FileX, List, LayoutGrid, Pencil, Trash2, CheckSquare2, Square, History,
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
  x:      number;
  y:      number;
  item:   DmsFolder | DmsFile;
  kind:   "folder" | "file";
  access: FolderAccess;
}

type ViewMode = "list" | "grid";

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
  menu,
  onView,
  onUpload,
  onNewFolder,
  onRename,
  onActivity,
  onDelete,
  onClose,
}: {
  menu:        CtxMenu;
  onView:      () => void;
  onUpload:    () => void;
  onNewFolder: () => void;
  onRename:    () => void;
  onActivity:  () => void;
  onDelete:    () => void;
  onClose:     () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /* Close on outside click or Escape */
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

  /* Flip position if near right / bottom edge */
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const estW = 176, estH = 160;
  const left = menu.x + estW > vw ? menu.x - estW : menu.x;
  const top  = menu.y + estH > vh ? menu.y - estH : menu.y;

  const { access, kind } = menu;

  const items = [
    { show: access.can_read,   icon: kind === "folder" ? <FolderOpen size={13}/> : <Eye size={13}/>,
      label: kind === "folder" ? "Open"        : "Preview",  action: onView   },
    { show: access.can_upload && kind === "folder",
      icon: <Upload size={13}/>,
      label: "Upload file here",                              action: onUpload },
    { show: access.can_upload && kind === "folder",
      icon: <FolderPlus size={13}/>,
      label: "New Folder",                                    action: onNewFolder },
    { show: access.can_write,  icon: <Pencil  size={13}/>, label: "Rename",   action: onRename },
    { show: true,              icon: <History size={13}/>, label: "Activity",  action: onActivity },
    { show: access.can_delete, icon: <Trash2  size={13}/>, label: "Delete",   action: onDelete, danger: true },
  ].filter((i) => i.show);

  if (items.length === 0) {
    items.push({ show: true, icon: <X size={13}/>, label: "No actions available", action: onClose });
  }

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-44"
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
              : "text-slate-700 hover:bg-slate-50"}`}
          data-testid={`ctx-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Rename Modal ───────────────────────────────────────────────────────── */

function RenameModal({
  current,
  kind,
  onClose,
  onRenamed,
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
        method:      "PATCH",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ id: current.id, type: kind, new_name: name.trim() }),
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-rename"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Rename {kind}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <X size={15} />
          </button>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
          data-testid="input-rename"
        />
        {error && <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={12}/> {error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={loading}
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
  target,
  kind,
  onClose,
  onDeleted,
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-delete"
      >
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
          <button
            onClick={handleDelete}
            disabled={loading}
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
            <a
              href={proxyUrl(file.id, true)}
              download={file.name}
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
            <iframe src={`/api/dms/file-preview?id=${file.id}`} title={file.name} className="w-full h-full min-h-[70vh]" data-testid="iframe-pdf-preview"/>
          )}
          {kind === "image" && (
            <div className="flex items-center justify-center p-6 h-full min-h-[60vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/dms/file-preview?id=${file.id}`} alt={file.name} className="max-w-full max-h-[75vh] rounded-lg object-contain shadow" data-testid="img-file-preview"/>
            </div>
          )}
          {kind === "unsupported" && (
            <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
              <div className="p-4 bg-slate-100 rounded-full"><FileX size={32} className="text-slate-400"/></div>
              <div>
                <p className="text-slate-700 font-medium text-sm">This file cannot be previewed. Please download.</p>
                <p className="text-slate-400 text-xs mt-1">{file.name}</p>
              </div>
              <a
                href={proxyUrl(file.id, true)}
                download={file.name}
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
  parentId, onClose, onCreated,
}: {
  parentId:  string;
  onClose:   () => void;
  onCreated: (folder: DmsFolder) => void;
}) {
  const [name, setName]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleCreate() {
    if (!name.trim()) { setError("Folder name is required."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/dms/folders", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), parent_id: parentId }),
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
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors" data-testid="btn-close-new-folder"><X size={15}/></button>
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
          <button
            onClick={handleCreate} disabled={loading}
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

export default function DmsMyFilesPage() {
  const [rootFolder,      setRootFolder]      = useState<DmsFolder | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolder,   setCurrentFolder]   = useState<DmsFolder | null>(null);
  const [breadcrumbs,     setBreadcrumbs]     = useState<BreadcrumbEntry[]>([]);

  const [folders,  setFolders]  = useState<DmsFolder[]>([]);
  const [files,    setFiles]    = useState<DmsFile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  const [uploading,     setUploading]     = useState(false);
  const [uploadError,   setUploadError]   = useState("");
  const [uploadDone,    setUploadDone]    = useState(false);
  const [isDragging,    setIsDragging]    = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);

  const [viewMode,    setViewMode]    = useState<ViewMode>("list");
  const [previewFile, setPreviewFile] = useState<DmsFile | null>(null);
  const [ctxMenu,     setCtxMenu]     = useState<CtxMenu | null>(null);
  const [renameTarget,      setRenameTarget]      = useState<{ id: string; name: string; kind: "folder" | "file" } | null>(null);
  const [deleteTarget,      setDeleteTarget]      = useState<{ id: string; name: string; kind: "folder" | "file" } | null>(null);
  const [activityTarget,    setActivityTarget]    = useState<{ id: string; name: string; kind: "folder" | "file" } | null>(null);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [rowPerms,          setRowPerms]          = useState<Record<string, FolderAccess>>({});

  const [allowFolderCreation, setAllowFolderCreation] = useState(false);

  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [selectedKind, setSelectedKind] = useState<Record<string, "folder" | "file">>({});
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError,    setBulkError]    = useState("");
  const [isZipping,    setIsZipping]    = useState(false);

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const uploadFolderRef = useRef<string | null>(null); // target folder for context-menu upload
  const accessCache    = useRef<Map<string, FolderAccess>>(new Map());
  const dblClickTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── on mount ── */
  useEffect(() => {
    Promise.all([
      fetch("/api/dms/ensure-user-folder", { method: "POST", credentials: "include" }).then((r) => r.json()),
      fetch("/api/dms/user-settings",      { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([folder, settings]: [DmsFolder, { allow_user_folder_creation: boolean }]) => {
        setRootFolder(folder);
        setCurrentFolderId(folder.id);
        setAllowFolderCreation(settings?.allow_user_folder_creation ?? false);
      })
      .catch(() => setError("Failed to initialise your file space."));
  }, []);

  /* ── load contents — single fetch returns { currentFolder, breadcrumbs, folders, files } ── */
  const loadContents = useCallback(async (folderId: string, rootFolderId?: string) => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/dms/folders?parent_id=${folderId}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to load contents."); return; }
      const { currentFolder: cf, breadcrumbs: bc, folders: fds, files: fis } = data;
      setCurrentFolder(cf ?? null);
      /* Override the first crumb's name to "My Files" for the personal folder view */
      const crumbs: BreadcrumbEntry[] = Array.isArray(bc) ? bc : [];
      const displayCrumbs = crumbs.map((c, i) =>
        i === 0 && c.id === (rootFolderId ?? rootFolder?.id) ? { ...c, name: "My Files" } : c,
      );
      setBreadcrumbs(displayCrumbs);
      setFolders(Array.isArray(fds) ? fds : []);
      setFiles(Array.isArray(fis)   ? fis : []);
    } catch {
      setError("Failed to load contents.");
    } finally {
      setLoading(false);
    }
  }, [rootFolder]);

  useEffect(() => { if (currentFolderId) loadContents(currentFolderId); }, [currentFolderId, loadContents]);

  /* ── batch-fetch permissions for list-view Delete buttons ── */
  useEffect(() => {
    if (!currentFolder || loading) return;
    const ids = new Set<string>([currentFolder.id, ...folders.map((f) => f.id)]);
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
    if (currentFolderId) loadContents(currentFolderId);
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

  /* ── navigate ── */
  function openFolder(folder: DmsFolder) {
    clearSelection();
    setCurrentFolderId(folder.id);
  }

  function navigateTo(entry: BreadcrumbEntry) {
    clearSelection();
    setCurrentFolderId(entry.id);
  }

  /* ── double-click on folder (grid + list rows) ── */
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

    let access: FolderAccess;
    const cached = accessCache.current.get(folder_id);
    if (cached) {
      access = cached;
    } else {
      try {
        const res = await fetch(`/api/dms/folder-access?folder_id=${folder_id}`, { credentials: "include" });
        access = await res.json() as FolderAccess;
        accessCache.current.set(folder_id, access);
      } catch {
        return;
      }
    }

    setCtxMenu({ x: e.clientX, y: e.clientY, item, kind, access });
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
    setShowNewFolder(true);
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

  /* ── after delete: wipe permission cache entry, refresh list ── */
  function applyDelete() {
    if (!deleteTarget) return;
    accessCache.current.delete(deleteTarget.id);
    setDeleteTarget(null);
    if (currentFolderId) loadContents(currentFolderId);
  }

  const totalItems = folders.length + files.length;

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

  /* ═══════════════════════════════════════════════════════════════════ */
  /* Render                                                             */
  /* ═══════════════════════════════════════════════════════════════════ */
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
          <h1 className="text-2xl font-bold text-slate-900">My Files</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your personal document storage</p>
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

          <button
            onClick={() => currentFolderId && loadContents(currentFolderId)}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh"
            data-testid="btn-refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""}/>
          </button>

          {allowFolderCreation && (
            <button
              onClick={() => { setNewFolderParentId(currentFolder?.id ?? null); setShowNewFolder(true); }}
              disabled={!currentFolder}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              data-testid="btn-new-folder"
            >
              <FolderPlus size={15}/> New Folder
            </button>
          )}

          {rowPerms[currentFolder?.id ?? ""]?.can_upload !== false && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !currentFolder}
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
        {/* Static Home link */}
        <Link
          href="/dashboard"
          className="text-blue-600 hover:underline font-medium"
          data-testid="breadcrumb-home"
        >
          Home
        </Link>

        {/* Dynamic folder crumbs */}
        {breadcrumbs.map((crumb, idx) => (
          <span key={crumb.id} className="flex items-center gap-1.5">
            <span className="text-slate-300 select-none font-light">/</span>
            {idx < breadcrumbs.length - 1 ? (
              <button
                onClick={() => navigateTo(crumb)}
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

      {/* ── Loading skeleton ── */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-3">
          {[1,2,3,4].map((i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse"/>)}
        </div>

      /* ── Empty state ── */
      ) : totalItems === 0 && !error ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
          <div className="p-4 bg-slate-50 rounded-full mb-4"><HardDrive size={32} className="text-slate-400"/></div>
          <p className="text-slate-700 font-medium">This folder is empty</p>
          <p className="text-slate-400 text-sm mt-1">
            {allowFolderCreation ? "Upload files or create a new folder to get started." : "Upload files to get started."}
          </p>
          <div className="flex items-center gap-2 mt-4">
            {allowFolderCreation && (
              <button onClick={() => { setNewFolderParentId(currentFolder?.id ?? null); setShowNewFolder(true); }} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors" data-testid="btn-new-folder-empty">
                <FolderPlus size={14}/> New Folder
              </button>
            )}
            {rowPerms[currentFolder?.id ?? ""]?.can_upload !== false && (
              <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors" data-testid="btn-upload-empty">
                <Upload size={14}/> Upload Files
              </button>
            )}
          </div>
        </div>

      /* ── Grid view ── */
      ) : viewMode === "grid" ? (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
          data-testid="grid-view"
        >
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
                        {rowPerms[folder.id]?.can_write !== false && (
                          <button
                            onClick={() => setRenameTarget({ id: folder.id, name: folder.name, kind: "folder" })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                            title="Rename folder"
                            data-testid={`btn-rename-folder-${folder.id}`}
                          >
                            <Pencil size={12}/>
                          </button>
                        )}
                        {rowPerms[folder.id]?.can_delete !== false && (
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
                        {rowPerms[currentFolder?.id ?? ""]?.can_write !== false && (
                          <button
                            onClick={() => setRenameTarget({ id: file.id, name: file.name, kind: "file" })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                            title="Rename file"
                            data-testid={`btn-rename-file-${file.id}`}
                          >
                            <Pencil size={12}/>
                          </button>
                        )}
                        {rowPerms[currentFolder?.id ?? ""]?.can_delete !== false && (
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
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* ── Rename Modal ── */}
      {renameTarget && (
        <RenameModal
          current={renameTarget}
          kind={renameTarget.kind}
          onClose={() => setRenameTarget(null)}
          onRenamed={applyRename}
        />
      )}

      {/* ── Delete Confirm Modal ── */}
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
      {showNewFolder && newFolderParentId && (
        <NewFolderModal
          parentId={newFolderParentId}
          onClose={() => { setShowNewFolder(false); setNewFolderParentId(null); }}
          onCreated={(folder) => {
            setShowNewFolder(false);
            setNewFolderParentId(null);
            setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
          }}
        />
      )}
    </div>
  );
}

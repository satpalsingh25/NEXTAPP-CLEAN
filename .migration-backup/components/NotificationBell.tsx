"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, CheckCheck, ExternalLink, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";

interface Notification {
  id:            string;
  title:         string;
  message:       string;
  type:          string;
  record_id:     string | null;
  record_module: string | null;
  is_read:       boolean;
  created_at:    string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function recordUrl(n: Notification): string | null {
  if (!n.record_id || !n.record_module) return null;
  if (n.record_module === "COMPLIANCE") return `/compliance/${n.record_id}`;
  if (n.record_module === "AMC")        return `/amc/${n.record_id}`;
  return null;
}

export default function NotificationBell() {
  const router                        = useRouter();
  const [open,          setOpen]      = useState(false);
  const [notifications, setNotifs]    = useState<Notification[]>([]);
  const [unreadCount,   setUnread]    = useState(0);
  const [loading,       setLoading]   = useState(false);
  const [markingAll,    setMarkingAll] = useState(false);
  const dropdownRef                   = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res  = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data.notifications ?? []);
      setUnread(data.unread_count  ?? 0);
    } catch {
      // silently ignore
    }
  }, []);

  // Initial fetch + poll every 60 s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleOpen() {
    setOpen((p) => !p);
    if (!open) {
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
    }
  }

  async function markAsRead(n: Notification) {
    if (!n.is_read) {
      await fetch(`/api/notifications/${n.id}`, {
        method: "PATCH", credentials: "include",
      });
      setNotifs((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
      );
      setUnread((p) => Math.max(0, p - 1));
    }

    const url = recordUrl(n);
    if (url) {
      setOpen(false);
      router.push(url);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    await fetch("/api/notifications", { method: "PATCH", credentials: "include" });
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    setMarkingAll(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        data-testid="btn-notification-bell"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span
            className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[17px] h-[17px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none"
            data-testid="badge-unread-count"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[380px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50"
          data-testid="dropdown-notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-slate-500" />
              <span className="text-sm font-semibold text-slate-800">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs font-semibold px-1.5 py-0.5 bg-red-50 text-red-600 rounded-full border border-red-100">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
                data-testid="btn-mark-all-read"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-50">
            {loading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-slate-200 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-100 rounded w-3/4" />
                      <div className="h-2.5 bg-slate-100 rounded w-full" />
                      <div className="h-2 bg-slate-100 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <Inbox size={32} className="text-slate-300" />
                <p className="text-sm font-medium text-slate-500">No notifications yet</p>
                <p className="text-xs text-slate-400">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => {
                const url      = recordUrl(n);
                const hasLink  = !!url;

                return (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n)}
                    className={`flex gap-3 px-4 py-3.5 cursor-pointer transition-colors ${
                      n.is_read
                        ? "hover:bg-slate-50"
                        : "bg-blue-50/60 hover:bg-blue-50"
                    }`}
                    data-testid={`notification-item-${n.id}`}
                  >
                    {/* Unread dot */}
                    <div className="pt-1.5 shrink-0">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          n.is_read ? "bg-transparent" : "bg-blue-500"
                        }`}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug truncate ${n.is_read ? "text-slate-700 font-medium" : "text-slate-900 font-semibold"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] text-slate-400">
                          {timeAgo(n.created_at)}
                        </span>
                        {hasLink && (
                          <span className="flex items-center gap-0.5 text-[11px] text-blue-500 font-medium">
                            <ExternalLink size={10} />
                            View {n.record_module === "AMC" ? "AMC" : "Compliance"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2.5 text-center">
              <span className="text-xs text-slate-400">
                Showing last {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

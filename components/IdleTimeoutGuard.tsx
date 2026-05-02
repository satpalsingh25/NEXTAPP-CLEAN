"use client";

import { useState, useCallback } from "react";
import { useAuth }               from "@/context/AuthContext";
import { useIdleTimeout }        from "@/hooks/useIdleTimeout";

/* ================================================================== */
/*  IdleTimeoutGuard                                                    */
/*                                                                      */
/*  Step 2: Forces re-login after 30 min of inactivity.               */
/*  Shows a warning dialog at 25 min so the user can stay logged in.  */
/*  Only active when a user is authenticated.                          */
/* ================================================================== */

const IDLE_MS = 30 * 60 * 1000;   // 30 minutes
const WARN_MS = 25 * 60 * 1000;   // warn at 25 minutes

export default function IdleTimeoutGuard() {
  const { user, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown,  setCountdown]   = useState(5 * 60); // seconds left

  const handleWarning = useCallback(() => {
    setShowWarning(true);
    setCountdown(5 * 60);

    /* Tick down the display counter every second */
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  const handleIdle = useCallback(() => {
    setShowWarning(false);
    logout();
  }, [logout]);

  const handleActive = useCallback(() => {
    setShowWarning(false);
  }, []);

  useIdleTimeout({
    idleAfterMs: IDLE_MS,
    warnAfterMs: WARN_MS,
    onWarning:   handleWarning,
    onIdle:      handleIdle,
    onActive:    handleActive,
    enabled:     !!user,         // only track when logged in
  });

  if (!showWarning) return null;

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Session Expiring Soon
        </h2>
        <p className="text-sm text-gray-500 mb-1">
          You&apos;ve been inactive. Your session will end in:
        </p>
        <p className="text-3xl font-mono font-bold text-amber-600 mb-5">
          {timeStr}
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleIdle}
            className="flex-1 py-2 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Log Out Now
          </button>
          <button
            onClick={handleActive}
            className="flex-1 py-2 px-4 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}

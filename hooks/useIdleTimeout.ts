"use client";

import { useEffect, useRef, useCallback } from "react";

/* ================================================================== */
/*  useIdleTimeout                                                      */
/*                                                                      */
/*  Tracks user activity (mouse, keyboard, touch, scroll) and fires    */
/*  onWarning after `warnAfterMs` of inactivity, then onIdle after    */
/*  `idleAfterMs` of inactivity.                                       */
/*                                                                      */
/*  Defaults: warn at 25 min, idle at 30 min.                          */
/* ================================================================== */

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
] as const;

interface UseIdleTimeoutOptions {
  idleAfterMs?:  number;  // default: 30 minutes
  warnAfterMs?:  number;  // default: 25 minutes
  onIdle:        () => void;
  onWarning?:    () => void;
  onActive?:     () => void;  // called when user resumes after warning
  enabled?:      boolean;
}

export function useIdleTimeout({
  idleAfterMs  = 30 * 60 * 1000,
  warnAfterMs  = 25 * 60 * 1000,
  onIdle,
  onWarning,
  onActive,
  enabled = true,
}: UseIdleTimeoutOptions) {
  const idleTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWarned     = useRef(false);

  const clearTimers = useCallback(() => {
    if (idleTimer.current)  clearTimeout(idleTimer.current);
    if (warnTimer.current)  clearTimeout(warnTimer.current);
  }, []);

  const resetTimers = useCallback(() => {
    if (!enabled) return;

    clearTimers();

    /* If user acts after a warning, notify the parent */
    if (isWarned.current) {
      isWarned.current = false;
      onActive?.();
    }

    /* Schedule warning */
    warnTimer.current = setTimeout(() => {
      isWarned.current = true;
      onWarning?.();
    }, warnAfterMs);

    /* Schedule idle logout */
    idleTimer.current = setTimeout(() => {
      onIdle();
    }, idleAfterMs);
  }, [enabled, clearTimers, warnAfterMs, idleAfterMs, onIdle, onWarning, onActive]);

  useEffect(() => {
    if (!enabled) return;

    /* Attach listeners */
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, resetTimers, { passive: true }),
    );

    /* Start the first timer */
    resetTimers();

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, resetTimers),
      );
    };
  }, [enabled, resetTimers, clearTimers]);
}

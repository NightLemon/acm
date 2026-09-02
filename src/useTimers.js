import { useState, useEffect, useRef, useCallback } from 'react';

const KEY = 'acm-prep-timers-v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Accumulated think-time per problem, in seconds: { [problemId]: number }.
 *
 * The curriculum repeatedly says "sit with it for 15 minutes before opening the
 * hints" — this is what makes that visible instead of aspirational. Time only
 * accrues while a problem row is expanded, and it survives reloads so a problem
 * you came back to twice shows the total.
 */
export function useTimers() {
  const [elapsed, setElapsed] = useState(load);
  // Which problem is currently accruing time, and since when (epoch ms).
  const running = useRef(null);

  // Persist on every change. Writes are cheap and infrequent (once a second at
  // most, and only for the single open problem).
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(elapsed));
    } catch {
      /* quota / private mode */
    }
  }, [elapsed]);

  // Single interval for the whole app rather than one per row.
  useEffect(() => {
    const t = setInterval(() => {
      const r = running.current;
      if (!r) return;
      const now = Date.now();
      const delta = Math.round((now - r.since) / 1000);
      if (delta <= 0) return;
      r.since = now;
      setElapsed((e) => ({ ...e, [r.id]: (e[r.id] || 0) + delta }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Pause while the tab is hidden — otherwise backgrounding the phone for an
  // hour records an hour of "thinking".
  useEffect(() => {
    const onVis = () => {
      const r = running.current;
      if (!r) return;
      if (document.hidden) r.since = Date.now();
      else r.since = Date.now();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const start = useCallback((id) => {
    running.current = { id, since: Date.now() };
  }, []);

  const stop = useCallback((id) => {
    const r = running.current;
    if (r && r.id === id) running.current = null;
  }, []);

  const clear = useCallback((id) => {
    setElapsed((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });
    const r = running.current;
    if (r && r.id === id) r.since = Date.now();
  }, []);

  return { elapsed, start, stop, clear };
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}:${String(s % 60).padStart(2, '0')}`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`;
}

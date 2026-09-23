import { useState, useEffect, useRef, useCallback } from 'react';
import { clearLibraryState, loadLibraryState, saveLibraryState } from './libraryState.js';

/**
 * Accumulated think-time per problem inside one library.
 */
export function useTimers(libraryId) {
  const [elapsed, setElapsed] = useState(() => loadLibraryState('timers', libraryId));
  // Which problem is currently accruing time, and since when (epoch ms).
  const running = useRef(null);

  // Persist on every change. Writes are cheap and infrequent (once a second at
  // most, and only for the single open problem).
  useEffect(() => {
    try {
      saveLibraryState('timers', libraryId, elapsed);
    } catch {
      /* quota / private mode */
    }
  }, [elapsed, libraryId]);

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

  const clearAll = useCallback(() => {
    running.current = null;
    setElapsed({});
    try { clearLibraryState('timers', libraryId); } catch { /* ignore */ }
  }, [libraryId]);

  return { elapsed, start, stop, clear, clearAll };
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}:${String(s % 60).padStart(2, '0')}`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`;
}

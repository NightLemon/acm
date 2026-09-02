import { useState, useEffect, useCallback } from 'react';

const KEY = 'acm-prep-progress-v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Progress is a flat map: { [problemId]: true }.
 * Kept deliberately dumb so it survives curriculum edits — adding or removing
 * problems never invalidates existing checkmarks.
 */
export function useProgress() {
  const [done, setDone] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(done));
    } catch {
      /* quota / private mode — progress just won't persist */
    }
  }, [done]);

  const toggle = useCallback((id) => {
    setDone((d) => {
      const next = { ...d };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    if (!confirm('清空所有进度、笔记和计时？此操作不可撤销。')) return;
    // Write straight to storage rather than going through setState — the
    // persist effect wouldn't get a chance to run before the reload below.
    // Notes and timers are keyed the same way and are meaningless without the
    // progress they annotate, so they go too.
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem('acm-prep-notes-v1');
      localStorage.removeItem('acm-prep-timers-v1');
    } catch { /* ignore */ }
    // Those live in sibling hooks with their own state; reloading is the
    // simplest way to get every consumer back in sync.
    location.reload();
  }, []);

  return { done, toggle, reset };
}

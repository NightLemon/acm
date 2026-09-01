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
    if (confirm('清空所有进度？此操作不可撤销。')) setDone({});
  }, []);

  return { done, toggle, reset };
}

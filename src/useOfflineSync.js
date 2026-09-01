import { useState, useCallback } from 'react';

// Warm the service worker's statement cache in one go, so the whole curriculum
// is readable offline instead of only the problems already opened.
export function useOfflineSync(ids) {
  const [state, setState] = useState({ running: false, done: 0, total: 0, finished: false, error: null });

  const start = useCallback(async () => {
    if (!('caches' in window)) {
      setState({ running: false, done: 0, total: 0, finished: false, error: '此浏览器不支持离线缓存' });
      return;
    }
    setState({ running: true, done: 0, total: ids.length, finished: false, error: null });

    const base = import.meta.env.BASE_URL;
    let done = 0;
    // Small concurrency: enough to be fast, not enough to stall a phone radio.
    const queue = [...ids];
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift();
        try {
          // Going through fetch (not cache.addAll) lets the SW's own handler
          // populate DATA_CACHE, keeping one code path for cache writes.
          await fetch(`${base}statements/${id}.json`);
        } catch { /* a missing statement is not fatal */ }
        done++;
        setState((s) => (s.running ? { ...s, done } : s));
      }
    };
    try {
      await Promise.all(Array.from({ length: 6 }, worker));
      setState((s) => ({ ...s, running: false, finished: true }));
    } catch (e) {
      setState((s) => ({ ...s, running: false, error: String(e) }));
    }
  }, [ids]);

  return { ...state, start };
}

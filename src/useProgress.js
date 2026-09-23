import { useState, useEffect, useCallback } from 'react';
import { clearLibraryState, loadLibraryState, saveLibraryState } from './libraryState.js';

/**
 * Progress stays flat inside one library and is namespaced in browser storage.
 */
export function useProgress(libraryId) {
  const [done, setDone] = useState(() => loadLibraryState('progress', libraryId));

  useEffect(() => {
    try {
      saveLibraryState('progress', libraryId, done);
    } catch {
      /* quota / private mode — progress just won't persist */
    }
  }, [done, libraryId]);

  const toggle = useCallback((id) => {
    setDone((d) => {
      const next = { ...d };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setDone({});
    try { clearLibraryState('progress', libraryId); } catch { /* ignore */ }
  }, [libraryId]);

  return { done, toggle, clear };
}

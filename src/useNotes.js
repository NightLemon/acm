import { useState, useEffect, useCallback } from 'react';
import { clearLibraryState, loadLibraryState, saveLibraryState } from './libraryState.js';

/**
 * Per-problem free text inside one library.
 */
export function useNotes(libraryId) {
  const [notes, setNotes] = useState(() => loadLibraryState('notes', libraryId));

  useEffect(() => {
    try {
      saveLibraryState('notes', libraryId, notes);
    } catch {
      /* quota / private mode — notes just won't persist */
    }
  }, [libraryId, notes]);

  const setNote = useCallback((id, text) => {
    setNotes((n) => {
      const next = { ...n };
      if (text.trim()) next[id] = text;
      else delete next[id];
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setNotes({});
    try { clearLibraryState('notes', libraryId); } catch { /* ignore */ }
  }, [libraryId]);

  return { notes, setNote, clear };
}

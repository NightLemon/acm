import { useState, useEffect, useCallback } from 'react';

const KEY = 'acm-prep-notes-v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Per-problem free text: { [problemId]: string }.
 * Meant for the one-line takeaway you want to see again on a second pass —
 * the state definition, the boundary that bit you, the trick you missed.
 * Same flat shape as progress so curriculum edits never invalidate it.
 */
export function useNotes() {
  const [notes, setNotes] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(notes));
    } catch {
      /* quota / private mode — notes just won't persist */
    }
  }, [notes]);

  const setNote = useCallback((id, text) => {
    setNotes((n) => {
      const next = { ...n };
      if (text.trim()) next[id] = text;
      else delete next[id];
      return next;
    });
  }, []);

  return { notes, setNote };
}

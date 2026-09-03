import { useCallback, useEffect, useMemo, useState } from 'react';

// One independent workspace per problem for the lifetime of this tab. A page
// reload or a new tab starts from the official template instead of restoring
// previously generated code from persistent browser storage.
const tabSessions = new Map();

export function emptyCodeSession() {
  return {
    version: 1,
    language: 'cpp',
    source: '',
    sources: { cpp: '', python: '' },
    targetName: '',
    confirmedSignature: '',
    messages: [],
    updatedAt: Date.now(),
  };
}

function normalizeSession(value) {
  const empty = emptyCodeSession();
  if (!value || value.version !== 1) return empty;
  const language = value.language === 'python' ? 'python' : 'cpp';
  const sources = {
    cpp: typeof value.sources?.cpp === 'string' ? value.sources.cpp : '',
    python: typeof value.sources?.python === 'string' ? value.sources.python : '',
  };
  if (!sources[language] && typeof value.source === 'string') sources[language] = value.source;
  return {
    ...empty,
    language,
    source: sources[language],
    sources,
    messages: Array.isArray(value.messages)
      ? value.messages
        .filter((message) => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
        .map((message) => message.kind === 'generated'
          ? { ...message, content: '代码已写入上方编辑器，可直接微调，或继续描述下一处修改。' }
          : message)
      : [],
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now(),
  };
}

export function useCodeSession(problemId) {
  const sessionKey = useMemo(() => problemId ? `problem:${problemId}` : 'standalone', [problemId]);
  const [session, setSession] = useState(() => normalizeSession(tabSessions.get(sessionKey)));

  useEffect(() => {
    tabSessions.set(sessionKey, session);
  }, [session, sessionKey]);

  const updateSession = useCallback((patch) => {
    setSession((current) => {
      const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
      const normalized = normalizeSession({ ...next, version: 1, updatedAt: Date.now() });
      tabSessions.set(sessionKey, normalized);
      return normalized;
    });
  }, [sessionKey]);

  const clearSession = useCallback((replacement) => {
    const next = normalizeSession(replacement || emptyCodeSession());
    tabSessions.set(sessionKey, next);
    setSession(next);
  }, [sessionKey]);

  return {
    session,
    updateSession,
    clearSession,
    ready: true,
    storageError: '',
    sessionKey,
  };
}

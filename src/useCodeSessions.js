import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const CODE_DESCRIPTIONS_KEY = 'acm-prep-code-descriptions-v1';

const MAX_PERSISTED_SESSIONS = 80;
const tabSessions = new Map();
const persistTimers = new Map();

function scheduleDescriptionPersist(sessionKey, session, onResult) {
  clearTimeout(persistTimers.get(sessionKey));
  const timer = setTimeout(() => {
    persistTimers.delete(sessionKey);
    try {
      persistCodeDescriptionSession(sessionKey, session);
      onResult('');
    } catch {
      onResult('描述草稿无法写入浏览器缓存，存储空间可能已满或不可用。');
    }
  }, 300);
  persistTimers.set(sessionKey, timer);
}

function flushScheduledDescriptionPersist(sessionKey, session) {
  const timer = persistTimers.get(sessionKey);
  if (!timer) return;
  clearTimeout(timer);
  persistTimers.delete(sessionKey);
  persistCodeDescriptionSession(sessionKey, session);
}

function cancelDescriptionPersists(libraryId) {
  const problemPrefix = `problem:${libraryId}:`;
  const standaloneKey = `standalone:${libraryId}`;
  for (const [key, timer] of persistTimers) {
    if (key.startsWith(problemPrefix) || key === standaloneKey) {
      clearTimeout(timer);
      persistTimers.delete(key);
    }
  }
}

function normalizeMessages(messages) {
  return Array.isArray(messages)
    ? messages
      .filter((message) => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
      .map((message) => ({
        id: typeof message.id === 'string' ? message.id : '',
        role: message.role,
        kind: typeof message.kind === 'string' ? message.kind : 'description',
        content: message.kind === 'generated'
          ? '代码已写入上方编辑器，可直接微调，或继续描述下一处修改。'
          : message.content,
        createdAt: Number.isFinite(message.createdAt) ? message.createdAt : Date.now(),
      }))
    : [];
}

export function loadCodeDescriptionCache(storage = localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(CODE_DESCRIPTIONS_KEY) || '{}');
    return parsed?.version === 1 && parsed.sessions && typeof parsed.sessions === 'object'
      ? parsed.sessions
      : {};
  } catch {
    return {};
  }
}

export function persistCodeDescriptionSession(sessionKey, session, storage = localStorage) {
  const sessions = loadCodeDescriptionCache(storage);
  const draft = typeof session?.draft === 'string' ? session.draft : '';
  const messages = normalizeMessages(session?.messages);

  if (!draft && messages.length === 0) {
    delete sessions[sessionKey];
  } else {
    sessions[sessionKey] = {
      language: session?.language === 'python' ? 'python' : 'cpp',
      draft,
      messages,
      updatedAt: Number.isFinite(session?.updatedAt) ? session.updatedAt : Date.now(),
    };
  }

  const limited = Object.fromEntries(
    Object.entries(sessions)
      .sort(([, a], [, b]) => (b?.updatedAt || 0) - (a?.updatedAt || 0))
      .slice(0, MAX_PERSISTED_SESSIONS)
  );
  storage.setItem(CODE_DESCRIPTIONS_KEY, JSON.stringify({ version: 1, sessions: limited }));
}

export function removeCodeDescriptionSessions(libraryId, storage = localStorage) {
  const sessions = loadCodeDescriptionCache(storage);
  const problemPrefix = `problem:${libraryId}:`;
  const standaloneKey = `standalone:${libraryId}`;
  for (const key of Object.keys(sessions)) {
    if (key.startsWith(problemPrefix) || key === standaloneKey) delete sessions[key];
  }
  storage.setItem(CODE_DESCRIPTIONS_KEY, JSON.stringify({ version: 1, sessions }));
}

export function emptyCodeSession() {
  return {
    version: 1,
    language: 'cpp',
    source: '',
    sources: { cpp: '', python: '' },
    targetName: '',
    confirmedSignature: '',
    draft: '',
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
    draft: typeof value.draft === 'string' ? value.draft : '',
    messages: normalizeMessages(value.messages),
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now(),
  };
}

export function useCodeSession(problemId, libraryId = 'default') {
  const sessionKey = useMemo(
    () => problemId ? `problem:${libraryId}:${problemId}` : `standalone:${libraryId}`,
    [libraryId, problemId]
  );
  const [session, setSession] = useState(() => {
    const inTab = tabSessions.get(sessionKey);
    if (inTab) return normalizeSession(inTab);
    const cached = loadCodeDescriptionCache()[sessionKey];
    return normalizeSession(cached ? { ...cached, version: 1 } : null);
  });
  const [storageError, setStorageError] = useState('');
  const mountedRef = useRef(true);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    mountedRef.current = true;
    const flush = () => {
      try { persistCodeDescriptionSession(sessionKey, sessionRef.current); }
      catch { /* the page is leaving, so there is nowhere useful to render the error */ }
    };
    window.addEventListener('pagehide', flush);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('pagehide', flush);
      try { flushScheduledDescriptionPersist(sessionKey, sessionRef.current); }
      catch { /* the workspace is already closing, so there is nowhere useful to render the error */ }
    };
  }, [sessionKey]);

  useEffect(() => {
    tabSessions.set(sessionKey, session);
    scheduleDescriptionPersist(sessionKey, session, (message) => {
      if (mountedRef.current) setStorageError(message);
    });
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
    try {
      persistCodeDescriptionSession(sessionKey, next);
      setStorageError('');
    } catch {
      setStorageError('描述草稿无法从浏览器缓存中清除。');
    }
  }, [sessionKey]);

  return {
    session,
    updateSession,
    clearSession,
    ready: true,
    storageError,
    sessionKey,
  };
}

export function clearCodeSessions(libraryId, storage = localStorage) {
  cancelDescriptionPersists(libraryId);
  for (const key of tabSessions.keys()) {
    if (key.startsWith(`problem:${libraryId}:`) || key === `standalone:${libraryId}`) tabSessions.delete(key);
  }
  removeCodeDescriptionSessions(libraryId, storage);
}

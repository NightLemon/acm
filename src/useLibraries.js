import { useCallback, useEffect, useMemo, useState } from 'react';
import { BUILTIN_LIBRARY_ID, hydrateLibrary, validateAndNormalizeLibrary } from './libraryData.js';
import {
  MAX_LIBRARY_BYTES,
  loadActiveLibraryId,
  loadCustomLibraries,
  removeCustomLibrary,
  saveActiveLibraryId,
  saveCustomLibraries,
  upsertCustomLibrary,
} from './libraryStorage.js';
import { removeAllLibraryState } from './libraryState.js';
import { clearCodeSessions } from './useCodeSessions.js';

let indexPromise;
function loadIndex() {
  if (!indexPromise) indexPromise = import('../data/leetcode-index.json').then((module) => module.default);
  return indexPromise;
}

export function useLibraries(builtinLibrary) {
  const [customLibraries, setCustomLibraries] = useState(loadCustomLibraries);
  const [activeId, setActiveId] = useState(() => loadActiveLibraryId(BUILTIN_LIBRARY_ID));
  const [activeLibrary, setActiveLibrary] = useState(() =>
    activeId === BUILTIN_LIBRARY_ID ? builtinLibrary : null
  );
  const [loading, setLoading] = useState(activeId !== BUILTIN_LIBRARY_ID);
  const [error, setError] = useState('');

  useEffect(() => {
    if (customLibraries.length === 0) return undefined;
    let alive = true;
    loadIndex().then((index) => {
      if (!alive) return;
      const upgraded = customLibraries.map((library) => validateAndNormalizeLibrary(library, index));
      if (JSON.stringify(upgraded) === JSON.stringify(customLibraries)) return;
      setCustomLibraries(upgraded);
      try {
        saveCustomLibraries(upgraded);
      } catch {
        setError('旧题库已在内存中升级，但无法回写浏览器存储，存储空间可能已满或不可用。');
      }
    }).catch(() => {
      // Active-library loading reports actionable validation/index errors separately.
    });
    return () => { alive = false; };
  }, []);

  const summaries = useMemo(() => [
    { id: builtinLibrary.id, name: builtinLibrary.name, builtin: true },
    ...customLibraries.map(({ id, name }) => ({ id, name, builtin: false })),
  ], [builtinLibrary, customLibraries]);

  const activate = useCallback((libraryId) => {
    const exists = libraryId === BUILTIN_LIBRARY_ID || customLibraries.some((library) => library.id === libraryId);
    const nextId = exists ? libraryId : BUILTIN_LIBRARY_ID;
    setActiveId(nextId);
    try {
      saveActiveLibraryId(nextId);
      setError('');
    } catch {
      setError('无法记住当前题库，浏览器存储可能已满或不可用。');
    }
  }, [customLibraries]);

  useEffect(() => {
    if (activeId === BUILTIN_LIBRARY_ID) {
      setActiveLibrary(builtinLibrary);
      setLoading(false);
      return undefined;
    }
    const raw = customLibraries.find((library) => library.id === activeId);
    if (!raw) {
      setActiveLibrary(builtinLibrary);
      setActiveId(BUILTIN_LIBRARY_ID);
      try { saveActiveLibraryId(BUILTIN_LIBRARY_ID); } catch { /* handled by fallback */ }
      setLoading(false);
      return undefined;
    }

    let alive = true;
    setLoading(true);
    loadIndex()
      .then((index) => {
        if (!alive) return;
        const normalized = validateAndNormalizeLibrary(raw, index);
        setActiveLibrary(hydrateLibrary(normalized, index));
        setError('');
      })
      .catch((loadError) => {
        if (!alive) return;
        setError(`题库“${raw.name || activeId}”无法加载：${loadError.message}`);
        setActiveId(BUILTIN_LIBRARY_ID);
        setActiveLibrary(builtinLibrary);
        try { saveActiveLibraryId(BUILTIN_LIBRARY_ID); } catch { /* keep in-memory fallback */ }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [activeId, builtinLibrary, customLibraries]);

  const importFile = useCallback(async (file) => {
    if (!file) return null;
    if (file.size > MAX_LIBRARY_BYTES) throw new Error('题库文件不能超过 1 MB');
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new Error('文件不是有效的 JSON');
    }
    const index = await loadIndex();
    const library = validateAndNormalizeLibrary(parsed, index);
    const exists = customLibraries.some((item) => item.id === library.id);
    if (exists && !window.confirm(`题库“${library.name}”已经存在，覆盖题库内容并保留刷题状态？`)) return null;

    const next = upsertCustomLibrary(customLibraries, library);
    try {
      saveCustomLibraries(next);
      saveActiveLibraryId(library.id);
    } catch {
      throw new Error('无法保存题库，浏览器存储空间可能不足');
    }
    setCustomLibraries(next);
    setActiveId(library.id);
    setError('');
    return library;
  }, [customLibraries]);

  const resolveUrl = useCallback(async (url) => {
    const index = await loadIndex();
    try {
      const library = validateAndNormalizeLibrary({
        schemaVersion: 1,
        id: 'url-loader',
        name: 'URL loader',
        groups: [{ name: 'URL', problems: [{ source: 'leetcode', url }] }],
      }, index);
      return hydrateLibrary(library, index).groups[0].problems[0];
    } catch (resolveError) {
      const message = resolveError?.message
        ?.replace(/\$\.groups\[0\]\.problems\[0\]\.url/g, '链接')
        .replace(/\$\.groups\[0\]\.problems\[0\]/g, '题目');
      throw new Error(message || '无法识别这个 LeetCode 链接');
    }
  }, []);

  const deleteLibrary = useCallback((libraryId) => {
    if (libraryId === BUILTIN_LIBRARY_ID) return;
    const next = removeCustomLibrary(customLibraries, libraryId);
    saveCustomLibraries(next);
    removeAllLibraryState(libraryId);
    clearCodeSessions(libraryId);
    setCustomLibraries(next);
    if (activeId === libraryId) {
      setActiveId(BUILTIN_LIBRARY_ID);
      setActiveLibrary(builtinLibrary);
      saveActiveLibraryId(BUILTIN_LIBRARY_ID);
    }
  }, [activeId, builtinLibrary, customLibraries]);

  return {
    summaries,
    activeId,
    activeLibrary,
    loading,
    error,
    activate,
    importFile,
    resolveUrl,
    deleteLibrary,
  };
}

export const LIBRARIES_KEY = 'acm-prep-libraries-v1';
export const ACTIVE_LIBRARY_KEY = 'acm-prep-active-library-v1';
export const MAX_LIBRARY_BYTES = 1024 * 1024;

export function loadCustomLibraries(storage = localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(LIBRARIES_KEY) || '{}');
    return parsed?.version === 1 && Array.isArray(parsed.libraries) ? parsed.libraries : [];
  } catch {
    return [];
  }
}

export function saveCustomLibraries(libraries, storage = localStorage) {
  storage.setItem(LIBRARIES_KEY, JSON.stringify({ version: 1, libraries }));
}

export function upsertCustomLibrary(libraries, library) {
  const index = libraries.findIndex((item) => item.id === library.id);
  if (index < 0) return [...libraries, library];
  const next = [...libraries];
  next[index] = library;
  return next;
}

export function removeCustomLibrary(libraries, libraryId) {
  return libraries.filter((library) => library.id !== libraryId);
}

export function loadActiveLibraryId(fallbackId, storage = localStorage) {
  try {
    return storage.getItem(ACTIVE_LIBRARY_KEY) || fallbackId;
  } catch {
    return fallbackId;
  }
}

export function saveActiveLibraryId(libraryId, storage = localStorage) {
  storage.setItem(ACTIVE_LIBRARY_KEY, libraryId);
}

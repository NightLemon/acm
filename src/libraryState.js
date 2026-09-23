import { BUILTIN_LIBRARY_ID } from './libraryData.js';

const MIGRATION_KEY = 'acm-prep-library-state-migrated-v2';
const TYPES = ['progress', 'notes', 'timers'];
const LEGACY_KEYS = {
  progress: 'acm-prep-progress-v1',
  notes: 'acm-prep-notes-v1',
  timers: 'acm-prep-timers-v1',
};

export function libraryStateKey(type, libraryId) {
  return `acm-prep-${type}-v2:${libraryId}`;
}

export function loadLibraryState(type, libraryId, storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(libraryStateKey(type, libraryId)) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function saveLibraryState(type, libraryId, value, storage = localStorage) {
  storage.setItem(libraryStateKey(type, libraryId), JSON.stringify(value));
}

export function clearLibraryState(type, libraryId, storage = localStorage) {
  storage.removeItem(libraryStateKey(type, libraryId));
}

export function removeAllLibraryState(libraryId, storage = localStorage) {
  for (const type of TYPES) clearLibraryState(type, libraryId, storage);
}

export function migrateLegacyState(storage = localStorage) {
  try {
    if (storage.getItem(MIGRATION_KEY)) return false;
    for (const type of TYPES) {
      const legacy = storage.getItem(LEGACY_KEYS[type]);
      const target = libraryStateKey(type, BUILTIN_LIBRARY_ID);
      if (legacy && !storage.getItem(target)) storage.setItem(target, legacy);
    }
    storage.setItem(MIGRATION_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

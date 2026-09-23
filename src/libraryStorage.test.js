import { describe, expect, it } from 'vitest';
import { BUILTIN_LIBRARY_ID } from './libraryData.js';
import {
  loadActiveLibraryId,
  loadCustomLibraries,
  removeCustomLibrary,
  saveActiveLibraryId,
  saveCustomLibraries,
  upsertCustomLibrary,
} from './libraryStorage.js';
import {
  libraryStateKey,
  loadLibraryState,
  migrateLegacyState,
  removeAllLibraryState,
  saveLibraryState,
} from './libraryState.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const library = (id, name = id) => ({ schemaVersion: 1, id, name, description: '', groups: [] });

describe('library definition storage', () => {
  it('saves, replaces and removes multiple libraries', () => {
    const storage = new MemoryStorage();
    let libraries = upsertCustomLibrary([], library('first'));
    libraries = upsertCustomLibrary(libraries, library('second'));
    libraries = upsertCustomLibrary(libraries, library('first', 'Updated'));
    saveCustomLibraries(libraries, storage);
    expect(loadCustomLibraries(storage).map((item) => item.name)).toEqual(['Updated', 'second']);
    expect(removeCustomLibrary(libraries, 'first').map((item) => item.id)).toEqual(['second']);
  });

  it('remembers the active library and falls back when empty', () => {
    const storage = new MemoryStorage();
    expect(loadActiveLibraryId(BUILTIN_LIBRARY_ID, storage)).toBe(BUILTIN_LIBRARY_ID);
    saveActiveLibraryId('first', storage);
    expect(loadActiveLibraryId(BUILTIN_LIBRARY_ID, storage)).toBe('first');
  });

  it('surfaces storage quota failures', () => {
    const storage = { setItem() { throw new Error('quota'); } };
    expect(() => saveCustomLibraries([library('first')], storage)).toThrow('quota');
  });
});

describe('per-library state', () => {
  it('isolates and removes progress, notes and timers by library id', () => {
    const storage = new MemoryStorage();
    saveLibraryState('progress', 'first', { 1: true }, storage);
    saveLibraryState('progress', 'second', { 49: true }, storage);
    saveLibraryState('notes', 'first', { 1: 'note' }, storage);
    saveLibraryState('timers', 'first', { 1: 12 }, storage);
    expect(loadLibraryState('progress', 'first', storage)).toEqual({ 1: true });
    expect(loadLibraryState('progress', 'second', storage)).toEqual({ 49: true });
    removeAllLibraryState('first', storage);
    expect(loadLibraryState('progress', 'first', storage)).toEqual({});
    expect(loadLibraryState('notes', 'first', storage)).toEqual({});
    expect(loadLibraryState('timers', 'first', storage)).toEqual({});
    expect(loadLibraryState('progress', 'second', storage)).toEqual({ 49: true });
  });

  it('migrates legacy state to the builtin library exactly once and keeps legacy keys', () => {
    const storage = new MemoryStorage();
    storage.setItem('acm-prep-progress-v1', JSON.stringify({ 1: true }));
    storage.setItem('acm-prep-notes-v1', JSON.stringify({ 1: 'old' }));
    expect(migrateLegacyState(storage)).toBe(true);
    expect(JSON.parse(storage.getItem(libraryStateKey('progress', BUILTIN_LIBRARY_ID)))).toEqual({ 1: true });
    expect(storage.getItem('acm-prep-progress-v1')).not.toBeNull();
    storage.setItem('acm-prep-progress-v1', JSON.stringify({ 49: true }));
    expect(migrateLegacyState(storage)).toBe(false);
    expect(loadLibraryState('progress', BUILTIN_LIBRARY_ID, storage)).toEqual({ 1: true });
  });
});

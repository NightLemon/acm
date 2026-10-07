import { describe, expect, it } from 'vitest';
import {
  CODE_DESCRIPTIONS_KEY,
  loadCodeDescriptionCache,
  persistCodeDescriptionSession,
  removeCodeDescriptionSessions,
} from './useCodeSessions.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

describe('code description cache', () => {
  it('persists draft, language and description history without editor code or provider secrets', () => {
    const storage = new MemoryStorage();
    persistCodeDescriptionSession('problem:library-a:49', {
      language: 'python',
      draft: '先统计每个字符的频率',
      source: 'secret generated source',
      apiKey: 'secret-key',
      messages: [{
        id: 'message-1',
        role: 'user',
        kind: 'description',
        content: '遍历字符串并更新哈希表',
        createdAt: 10,
        hidden: 'must not persist',
      }],
      updatedAt: 20,
    }, storage);

    const cached = loadCodeDescriptionCache(storage)['problem:library-a:49'];
    expect(cached).toMatchObject({
      language: 'python',
      draft: '先统计每个字符的频率',
      updatedAt: 20,
    });
    expect(cached.messages[0]).toEqual({
      id: 'message-1',
      role: 'user',
      kind: 'description',
      content: '遍历字符串并更新哈希表',
      createdAt: 10,
    });
    expect(storage.getItem(CODE_DESCRIPTIONS_KEY)).not.toContain('secret generated source');
    expect(storage.getItem(CODE_DESCRIPTIONS_KEY)).not.toContain('secret-key');
    expect(storage.getItem(CODE_DESCRIPTIONS_KEY)).not.toContain('must not persist');
  });

  it('isolates sessions and removes only the selected library', () => {
    const storage = new MemoryStorage();
    persistCodeDescriptionSession('problem:library-a:1', { draft: 'A', updatedAt: 1 }, storage);
    persistCodeDescriptionSession('standalone:library-a', { draft: 'A standalone', updatedAt: 2 }, storage);
    persistCodeDescriptionSession('problem:library-b:1', { draft: 'B', updatedAt: 3 }, storage);

    removeCodeDescriptionSessions('library-a', storage);
    expect(Object.keys(loadCodeDescriptionCache(storage))).toEqual(['problem:library-b:1']);
  });

  it('deletes empty sessions and ignores corrupt cache data', () => {
    const storage = new MemoryStorage();
    persistCodeDescriptionSession('problem:library-a:1', { draft: 'keep' }, storage);
    persistCodeDescriptionSession('problem:library-a:1', { draft: '', messages: [] }, storage);
    expect(loadCodeDescriptionCache(storage)).toEqual({});

    storage.setItem(CODE_DESCRIPTIONS_KEY, '{broken');
    expect(loadCodeDescriptionCache(storage)).toEqual({});
  });

  it('keeps only the 80 most recently updated workspaces', () => {
    const storage = new MemoryStorage();
    for (let index = 0; index < 85; index += 1) {
      persistCodeDescriptionSession(`problem:library-a:${index}`, {
        draft: `draft-${index}`,
        updatedAt: index,
      }, storage);
    }
    const cached = loadCodeDescriptionCache(storage);
    expect(Object.keys(cached)).toHaveLength(80);
    expect(cached['problem:library-a:0']).toBeUndefined();
    expect(cached['problem:library-a:84'].draft).toBe('draft-84');
  });

  it('persists custom statements, both language frameworks and entry mode only for standalone workspaces', () => {
    const storage = new MemoryStorage();
    const session = {
      localStatement: 'A private custom problem',
      entryMode: 'function',
      sources: { cpp: 'int main() {}', python: 'def solve(): pass' },
      provider: { apiKey: 'must-not-persist' },
      draft: '',
      messages: [],
    };
    persistCodeDescriptionSession('standalone:library-a', session, storage);
    expect(loadCodeDescriptionCache(storage)['standalone:library-a']).toMatchObject({
      localStatement: session.localStatement,
      entryMode: 'function',
      sources: session.sources,
    });
    expect(storage.getItem(CODE_DESCRIPTIONS_KEY)).not.toContain('must-not-persist');
    persistCodeDescriptionSession('problem:library-a:1', { ...session, draft: 'description' }, storage);
    expect(loadCodeDescriptionCache(storage)['problem:library-a:1'].sources).toBeUndefined();
    expect(loadCodeDescriptionCache(storage)['problem:library-a:1'].localStatement).toBeUndefined();
    persistCodeDescriptionSession('standalone:library-a', { draft: '', messages: [] }, storage);
    expect(loadCodeDescriptionCache(storage)['standalone:library-a']).toBeUndefined();
  });
});

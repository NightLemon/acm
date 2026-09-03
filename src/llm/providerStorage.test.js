import { describe, expect, it } from 'vitest';
import {
  clearStoredApiKey,
  loadProviderSettings,
  providerStorageKeys,
  saveProviderSettings,
} from './providerStorage.js';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

describe('providerStorage', () => {
  it('默认只将 key 写入当前会话存储', () => {
    const local = storage();
    const session = storage();
    saveProviderSettings({ baseUrl: 'https://a.test/v1', model: 'm', apiKey: 'session-key', rememberKey: false }, local, session);

    expect(local.getItem(providerStorageKeys.persistentKey)).toBeNull();
    expect(session.getItem(providerStorageKeys.sessionKey)).toBe('session-key');
    expect(loadProviderSettings(local, session).apiKey).toBe('session-key');
  });

  it('只在明确选择后持久化，并可彻底清除', () => {
    const local = storage();
    const session = storage();
    saveProviderSettings({ baseUrl: 'https://a.test/v1', model: 'm', apiKey: 'persistent-key', rememberKey: true }, local, session);

    expect(local.getItem(providerStorageKeys.persistentKey)).toBe('persistent-key');
    expect(session.getItem(providerStorageKeys.sessionKey)).toBeNull();

    clearStoredApiKey(local, session);
    expect(loadProviderSettings(local, session).apiKey).toBe('');
    expect(loadProviderSettings(local, session).rememberKey).toBe(false);
  });
});

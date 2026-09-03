const CONFIG_KEY = 'acm-code-provider-v1';
const SESSION_KEY = 'acm-code-provider-session-key-v1';
const PERSISTENT_KEY = 'acm-code-provider-persistent-key-v1';

export const DEFAULT_PROVIDER = {
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  apiKey: '',
  rememberKey: false,
};

export function loadProviderSettings(local = localStorage, session = sessionStorage) {
  let stored = {};
  try { stored = JSON.parse(local.getItem(CONFIG_KEY) || '{}'); } catch { /* ignored */ }
  const rememberKey = stored.rememberKey === true;
  let apiKey = '';
  try {
    apiKey = rememberKey
      ? local.getItem(PERSISTENT_KEY) || ''
      : session.getItem(SESSION_KEY) || '';
  } catch { /* ignored */ }
  return {
    ...DEFAULT_PROVIDER,
    baseUrl: typeof stored.baseUrl === 'string' ? stored.baseUrl : DEFAULT_PROVIDER.baseUrl,
    model: typeof stored.model === 'string' ? stored.model : '',
    rememberKey,
    apiKey,
  };
}

export function saveProviderSettings(settings, local = localStorage, session = sessionStorage) {
  local.setItem(CONFIG_KEY, JSON.stringify({
    baseUrl: String(settings.baseUrl || ''),
    model: String(settings.model || ''),
    rememberKey: settings.rememberKey === true,
  }));

  if (settings.rememberKey) {
    local.setItem(PERSISTENT_KEY, String(settings.apiKey || ''));
    session.removeItem(SESSION_KEY);
  } else {
    session.setItem(SESSION_KEY, String(settings.apiKey || ''));
    local.removeItem(PERSISTENT_KEY);
  }
}

export function clearStoredApiKey(local = localStorage, session = sessionStorage) {
  local.removeItem(PERSISTENT_KEY);
  session.removeItem(SESSION_KEY);
  let stored = {};
  try { stored = JSON.parse(local.getItem(CONFIG_KEY) || '{}'); } catch { /* ignored */ }
  local.setItem(CONFIG_KEY, JSON.stringify({ ...stored, rememberKey: false }));
}

export const providerStorageKeys = {
  config: CONFIG_KEY,
  sessionKey: SESSION_KEY,
  persistentKey: PERSISTENT_KEY,
};

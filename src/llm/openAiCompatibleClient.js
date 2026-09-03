export class LlmRequestError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'LlmRequestError';
    this.status = status;
  }
}

function validatedBaseUrl(baseUrl) {
  const raw = String(baseUrl || '').trim().replace(/\/+$/, '');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Base URL 不是有效地址。');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Base URL 必须使用 HTTPS；仅 localhost 可使用 HTTP。');
  }
  return url;
}

export function chatCompletionsUrl(baseUrl) {
  const url = validatedBaseUrl(baseUrl);
  return /\/chat\/completions$/i.test(url.pathname)
    ? url.href.replace(/\/$/, '')
    : `${url.href.replace(/\/$/, '')}/chat/completions`;
}

export function modelsUrl(baseUrl) {
  const url = validatedBaseUrl(baseUrl);
  if (/\/chat\/completions$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/chat\/completions$/i, '/models');
    return url.href.replace(/\/$/, '');
  }
  return /\/models$/i.test(url.pathname)
    ? url.href.replace(/\/$/, '')
    : `${url.href.replace(/\/$/, '')}/models`;
}

export function validateProviderConfig(config) {
  chatCompletionsUrl(config?.baseUrl);
  if (!String(config?.model || '').trim()) throw new Error('请填写模型名称。');
  if (!String(config?.apiKey || '').trim()) throw new Error('请填写 API key。');
}

async function errorFromResponse(response, secrets = []) {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message || body?.message || '';
  } catch {
    try { detail = await response.text(); } catch { /* ignored */ }
  }
  let safe = String(detail || '').replace(/\s+/g, ' ').trim();
  for (const secret of secrets) {
    if (secret) safe = safe.split(secret).join('[已隐藏]');
  }
  safe = safe.slice(0, 300);
  return new LlmRequestError(
    `LLM 请求失败（HTTP ${response.status}）${safe ? `：${safe}` : ''}`,
    response.status
  );
}

async function postChat(config, messages, stream, signal, fetchImpl = fetch) {
  validateProviderConfig(config);
  let response;
  try {
    response = await fetchImpl(chatCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model.trim(),
        messages: messages.map(({ role, content }) => ({ role, content })),
        stream,
      }),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new LlmRequestError('无法连接 LLM API。请检查 Base URL、网络和 Provider 的浏览器 CORS 配置。');
  }
  if (!response.ok) throw await errorFromResponse(response, [config.apiKey]);
  return response;
}

export async function listModels(config, { signal, fetchImpl = fetch } = {}) {
  if (!String(config?.apiKey || '').trim()) throw new Error('请填写 API key。');
  let response;
  try {
    response = await fetchImpl(modelsUrl(config.baseUrl), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new LlmRequestError('无法探测模型。请检查 Base URL、API key、网络和 Provider 的浏览器 CORS 配置。');
  }
  if (!response.ok) throw await errorFromResponse(response, [config.apiKey]);

  let body;
  try { body = await response.json(); }
  catch { throw new LlmRequestError('模型列表不是合法 JSON。'); }
  const entries = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  const ids = entries
    .map((item) => typeof item === 'string' ? item : item?.id)
    .filter((id) => typeof id === 'string' && id.trim())
    .map((id) => id.trim());
  const models = [...new Set(ids)].sort((a, b) => a.localeCompare(b));
  if (!models.length) throw new LlmRequestError('Provider 的 /models 没有返回可用模型；仍可手动填写模型名称。');
  return models;
}

export async function completeChat(config, messages, { signal, fetchImpl } = {}) {
  const response = await postChat(config, messages, false, signal, fetchImpl);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new LlmRequestError('LLM 返回了无法解析的响应。');
  }
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new LlmRequestError('LLM 响应中没有文本内容。');
  return content;
}

function eventBoundary(buffer) {
  const match = /\r?\n\r?\n/.exec(buffer);
  return match ? { index: match.index, length: match[0].length } : null;
}

function eventData(block) {
  return block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n');
}

function deltaText(payload) {
  const content = payload?.choices?.[0]?.delta?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === 'string' ? part : part?.text || '').join('');
  }
  return '';
}

export async function consumeChatCompletionStream(stream, onDelta, signal) {
  if (!stream?.getReader) throw new LlmRequestError('Provider 没有返回可读取的流。');
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneEvent = false;

  const processBlock = (block) => {
    const data = eventData(block);
    if (!data) return;
    if (data.trim() === '[DONE]') { doneEvent = true; return; }
    let payload;
    try { payload = JSON.parse(data); }
    catch { throw new LlmRequestError('Provider 返回了损坏的 SSE 数据。'); }
    if (payload?.error) throw new LlmRequestError(payload.error.message || 'Provider 流式返回错误。');
    const text = deltaText(payload);
    if (text) onDelta(text);
  };

  try {
    while (!doneEvent) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = eventBoundary(buffer);
      while (boundary) {
        const block = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);
        processBlock(block);
        if (doneEvent) break;
        boundary = eventBoundary(buffer);
      }
    }
    buffer += decoder.decode();
    if (!doneEvent && buffer.trim()) processBlock(buffer);
  } finally {
    reader.releaseLock();
  }
}

export async function streamChat(config, messages, { signal, onDelta, fetchImpl } = {}) {
  const response = await postChat(config, messages, true, signal, fetchImpl);
  let output = '';
  await consumeChatCompletionStream(response.body, (text) => {
    output += text;
    onDelta?.(text, output);
  }, signal);
  return output;
}

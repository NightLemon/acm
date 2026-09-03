import { describe, expect, it, vi } from 'vitest';
import {
  chatCompletionsUrl,
  completeChat,
  consumeChatCompletionStream,
  listModels,
  modelsUrl,
  streamChat,
} from './openAiCompatibleClient.js';

function byteStream(parts) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      parts.forEach((part) => controller.enqueue(encoder.encode(part)));
      controller.close();
    },
  });
}

const config = { baseUrl: 'https://provider.test/v1', model: 'model-a', apiKey: 'top-secret' };

describe('OpenAI-compatible client', () => {
  it('规范化 Chat Completions URL 并拒绝不安全远端 HTTP', () => {
    expect(chatCompletionsUrl('https://provider.test/v1/')).toBe('https://provider.test/v1/chat/completions');
    expect(chatCompletionsUrl('http://localhost:24444/v1')).toBe('http://localhost:24444/v1/chat/completions');
    expect(modelsUrl('https://provider.test/v1/')).toBe('https://provider.test/v1/models');
    expect(modelsUrl('https://provider.test/v1/chat/completions')).toBe('https://provider.test/v1/models');
    expect(() => chatCompletionsUrl('http://provider.test/v1')).toThrow('HTTPS');
  });

  it('解析跨任意 chunk 的 SSE 内容', async () => {
    const stream = byteStream([
      'data: {"choices":[{"delta":{"content":"hel',
      'lo"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\r',
      '\n\r\ndata: [DONE]\n\n',
    ]);
    let result = '';

    await consumeChatCompletionStream(stream, (text) => { result += text; });
    expect(result).toBe('hello world');
  });

  it('发送严格的非流式请求并读取文本', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"status":"ready","questions":[]}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const output = await completeChat(config, [{ role: 'user', content: 'hello' }], { fetchImpl });
    const [, options] = fetchImpl.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(output).toContain('ready');
    expect(options.headers.Authorization).toBe('Bearer top-secret');
    expect(body).toEqual({
      model: 'model-a',
      messages: [{ role: 'user', content: 'hello' }],
      stream: false,
    });
    expect(body).not.toHaveProperty('temperature');
  });

  it('从 /models 自动探测并整理模型名称', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'model-b' }, { id: 'model-a' }, { id: 'model-b' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const models = await listModels(config, { fetchImpl });
    const [url, options] = fetchImpl.mock.calls[0];

    expect(url).toBe('https://provider.test/v1/models');
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe('Bearer top-secret');
    expect(models).toEqual(['model-a', 'model-b']);
  });

  it('模型探测错误不会回显 API key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'invalid top-secret credential' },
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));

    await expect(listModels(config, { fetchImpl })).rejects.not.toThrow('top-secret');
  });

  it('流式完成后返回完整文本', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(byteStream([
      'data: {"choices":[{"delta":{"content":"code"}}]}\n\n',
      'data: [DONE]\n\n',
    ]), { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
    const deltas = [];

    const output = await streamChat(config, [], { fetchImpl, onDelta: (delta) => deltas.push(delta) });
    expect(output).toBe('code');
    expect(deltas).toEqual(['code']);
  });

  it('Provider 错误正文不会回显 API key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'invalid top-secret credential' },
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));

    await expect(completeChat(config, [], { fetchImpl })).rejects.not.toThrow('top-secret');
  });
});

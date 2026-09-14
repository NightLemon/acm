import { describe, expect, it } from 'vitest';
import {
  buildGenerationMessages,
  buildValidationMessages,
  parseGeneratedResponse,
  parseValidationResponse,
} from './prompts.js';

const request = {
  language: 'cpp',
  maskedSource: 'class Solution { public: int __TARGET_FUNCTION__(int x); };',
  targetName: 'secretMethod',
  conversation: [
    { role: 'user', kind: 'description', content: '在 secretMethod 中返回 x。' },
    { role: 'assistant', kind: 'clarification', content: 'x 为负数时返回什么？' },
    { role: 'assistant', kind: 'generated', content: '不应再次发送的旧代码' },
  ],
  problemId: '1234',
  title: 'Secret Problem',
  url: 'https://example.test/problem',
  tags: ['dp'],
};

describe('prompt request allowlist', () => {
  it.each([buildValidationMessages, buildGenerationMessages])('不发送本地题目字段和真实函数名', (builder) => {
    const serialized = JSON.stringify(builder(request));

    expect(serialized).not.toContain('1234');
    expect(serialized).not.toContain('Secret Problem');
    expect(serialized).not.toContain('example.test');
    expect(serialized).not.toContain('secretMethod');
    expect(serialized).not.toContain('不应再次发送的旧代码');
    expect(serialized).toContain('__TARGET_FUNCTION__');
    expect(serialized).toContain('在 __TARGET_FUNCTION__ 中返回 x');
  });

  it.each([buildValidationMessages, buildGenerationMessages])('设计类隐藏类名和所有方法名', (builder) => {
    const serialized = JSON.stringify(builder({
      language: 'cpp',
      maskedSource: 'class __TARGET_CLASS__ { public: __TARGET_CLASS__(int capacity); int __TARGET_METHOD_1__(int key); void __TARGET_METHOD_2__(int key, int value); };',
      mappings: [
        { name: 'LRUCache', placeholder: '__TARGET_CLASS__', kind: 'class' },
        { name: 'get', placeholder: '__TARGET_METHOD_1__', kind: 'method' },
        { name: 'put', placeholder: '__TARGET_METHOD_2__', kind: 'method' },
      ],
      interfaceKind: 'design-class',
      signatures: [
        '__TARGET_CLASS__(int capacity)',
        'int __TARGET_METHOD_1__(int key)',
        'void __TARGET_METHOD_2__(int key, int value)',
      ],
      conversation: [{ role: 'user', kind: 'description', content: 'LRUCache 的 get 和 put 都按我描述的链表规则实现。' }],
    }));

    expect(serialized).not.toContain('LRUCache');
    expect(serialized).not.toMatch(/\bget\b|\bput\b/);
    expect(serialized).toContain('__TARGET_CLASS__');
    expect(serialized).toContain('__TARGET_METHOD_1__');
    expect(serialized).toContain('__TARGET_METHOD_2__');
  });
});

describe('strict response parsing', () => {
  it('接受 ready 与澄清结果', () => {
    expect(parseValidationResponse('{"status":"ready","questions":[]}')).toEqual({ status: 'ready', questions: [] });
    expect(parseValidationResponse('{"status":"needs_clarification","questions":["边界是什么？"]}')).toEqual({
      status: 'needs_clarification',
      questions: ['边界是什么？'],
    });
  });

  it('拒绝非法或矛盾的校验结果', () => {
    expect(() => parseValidationResponse('ready')).toThrow();
    expect(() => parseValidationResponse('{"status":"ready","questions":["多余问题"]}')).toThrow();
    expect(() => parseValidationResponse('{"status":"needs_clarification","questions":[]}')).toThrow();
  });

  it('只接受包含脱敏目标的原始代码', () => {
    expect(parseGeneratedResponse('class Solution { int __TARGET_FUNCTION__(); };').status).toBe('generated');
    expect(() => parseGeneratedResponse('```cpp\nint __TARGET_FUNCTION__();\n```')).toThrow();
    expect(() => parseGeneratedResponse('int anotherFunction();')).toThrow();
  });

  it('设计类生成结果必须保留全部接口占位符', () => {
    const placeholders = ['__TARGET_CLASS__', '__TARGET_METHOD_1__', '__TARGET_METHOD_2__'];
    const complete = 'class __TARGET_CLASS__ { __TARGET_CLASS__(int n); int __TARGET_METHOD_1__(int k); void __TARGET_METHOD_2__(int k, int v); };';
    const missingPut = 'class __TARGET_CLASS__ { __TARGET_CLASS__(int n); int __TARGET_METHOD_1__(int k); };';

    expect(parseGeneratedResponse(complete, placeholders).status).toBe('generated');
    expect(() => parseGeneratedResponse(missingPut, placeholders)).toThrow('__TARGET_METHOD_2__');
  });

  it('生成阶段可退回澄清而不生成代码', () => {
    expect(parseGeneratedResponse('__NEEDS_CLARIFICATION__\n空数组时返回什么？')).toEqual({
      status: 'needs_clarification',
      questions: ['空数组时返回什么？'],
    });
  });
});

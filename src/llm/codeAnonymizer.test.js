import { describe, expect, it } from 'vitest';
import {
  MASKED_FUNCTION,
  detectTargetInterface,
  detectTargetFunction,
  isConfirmedTargetUnchanged,
  isTargetInterfaceUnchanged,
  maskTargetInterface,
  replaceIdentifier,
  restoreTargetInterface,
  restoreIdentifier,
} from './codeAnonymizer.js';

describe('codeAnonymizer', () => {
  it('识别并脱敏唯一的 C++ public 方法', () => {
    const source = `class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        return 0;
    }
private:
    int helper(int x) { return x; }
};`;
    const result = detectTargetFunction(source, 'cpp');

    expect(result.ok).toBe(true);
    expect(result.targetName).toBe('findMedianSortedArrays');
    expect(result.signature).toContain(`${MASKED_FUNCTION}(`);
    expect(result.maskedSource).not.toContain('findMedianSortedArrays');
    expect(restoreIdentifier(result.maskedSource, result.targetName)).toBe(source);
  });

  it('拒绝多个 C++ public 候选', () => {
    const source = `class Solution {
public:
    int first(int x) { return x; }
    int second(int x) { return x; }
};`;
    const result = detectTargetFunction(source, 'cpp');

    expect(result.ok).toBe(false);
    expect(result.candidates.map((item) => item.name)).toEqual(['first', 'second']);
  });

  it('识别 Python 类成员并忽略嵌套函数', () => {
    const source = `class Solution:
    def calculate(self, nums: list[int]) -> int:
        def helper(value):
            return value
        return helper(0)
`;
    const result = detectTargetFunction(source, 'python');

    expect(result.ok).toBe(true);
    expect(result.targetName).toBe('calculate');
    expect(result.maskedSource).toContain('def __TARGET_FUNCTION__');
  });

  it('接口发生变化后确认失效', () => {
    const source = 'class Solution { public: int solve(int x) { return x; } };';
    const result = detectTargetFunction(source, 'cpp');
    const changed = 'class Solution { public: int solve(long long x) { return x; } };';

    expect(result.ok).toBe(true);
    expect(isConfirmedTargetUnchanged(source, 'cpp', 'solve', result.signature)).toBe(true);
    expect(isConfirmedTargetUnchanged(changed, 'cpp', 'solve', result.signature)).toBe(false);
  });

  it('只替换完整 identifier token', () => {
    const masked = replaceIdentifier('solve(x); resolver(); obj.solve(y); // solve', 'solve');
    expect(masked).toBe('__TARGET_FUNCTION__(x); resolver(); obj.__TARGET_FUNCTION__(y); // __TARGET_FUNCTION__');
  });

  it('识别并脱敏 C++ 多方法设计类', () => {
    const source = `class LRUCache {
public:
    LRUCache(int capacity) {}
    int get(int key) { return -1; }
    void put(int key, int value) {}
};

// LRUCache* obj = new LRUCache(capacity);
// int value = obj->get(key);
// obj->put(key, value);`;
    const result = detectTargetInterface(source, 'cpp');

    expect(result).toMatchObject({
      ok: true,
      kind: 'design-class',
      className: 'LRUCache',
      placeholders: ['__TARGET_CLASS__', '__TARGET_METHOD_1__', '__TARGET_METHOD_2__'],
    });
    expect(result.mappings.map((mapping) => mapping.name)).toEqual(['LRUCache', 'get', 'put']);
    expect(result.maskedSource).not.toMatch(/LRUCache|\bget\b|\bput\b/);
    expect(result.maskedSource).toContain('class __TARGET_CLASS__');
    expect(result.maskedSource).toContain('int __TARGET_METHOD_1__(int key)');
    expect(restoreTargetInterface(result.maskedSource, result.mappings)).toBe(source);
    expect(isTargetInterfaceUnchanged(source, 'cpp', result)).toBe(true);
    expect(isTargetInterfaceUnchanged(`class LRUCache {
    int capacity;
  public:
    LRUCache(int capacity) : capacity(capacity) {}
    int get(int key) { return key; }
    void put(int key, int value) { capacity = value; }
  };`, 'cpp', result)).toBe(true);
    expect(isTargetInterfaceUnchanged(source.replace('int get(int key)', 'int get(long long key)'), 'cpp', result)).toBe(false);
  });

  it('识别并脱敏 Python 多方法设计类', () => {
    const source = `class LRUCache:
    def __init__(self, capacity: int):
        pass

    def get(self, key: int) -> int:
        return -1

    def put(self, key: int, value: int) -> None:
        pass
`;
    const result = detectTargetInterface(source, 'python');

    expect(result.ok).toBe(true);
    expect(result.kind).toBe('design-class');
    expect(result.maskedSource).toContain('class __TARGET_CLASS__');
    expect(result.maskedSource).toContain('def __TARGET_METHOD_1__');
    expect(result.maskedSource).toContain('def __TARGET_METHOD_2__');
    expect(isTargetInterfaceUnchanged(source.replace(
      '    def get(self, key: int) -> int:',
      '    def _unlink(self, node):\n        pass\n\n    def get(self, key: int) -> int:'
    ), 'python', result)).toBe(true);
  });
});

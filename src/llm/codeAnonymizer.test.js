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

  it('支持 C++ 普通函数、多行签名与 main，并保留框架', () => {
    const source = `#include <iostream>
using namespace std;
int compute(
    int value
) { return 0; }
int main() {
    int value;
    cin >> value;
    cout << compute(value) << '\\n';
}`;
    const result = detectTargetInterface(source, 'cpp', 'function');
    expect(result.ok).toBe(true);
    expect(result.kind).toBe('free-functions');
    expect(result.mappings.map((item) => item.name)).toEqual(['compute', 'main']);
    expect(result.maskedSource).not.toMatch(/\bcompute\b|\bmain\b/);
    expect(restoreTargetInterface(result.maskedSource, result.mappings)).toBe(source);
    expect(isTargetInterfaceUnchanged(source.replace('return 0;', 'return value * 2;'), 'cpp', result)).toBe(true);
    expect(isTargetInterfaceUnchanged(source.replace('int value\n)', 'long value\n)'), 'cpp', result)).toBe(false);
    expect(isTargetInterfaceUnchanged(source.replace('#include <iostream>', ''), 'cpp', result)).toBe(false);
    expect(isTargetInterfaceUnchanged(source.slice(0, source.indexOf('int main')), 'cpp', result)).toBe(false);
  });

  it('支持 Python 普通函数和标准输入输出入口，保护调用框架', () => {
    const source = `import sys
def solve(value: int) -> int:
    pass

def main():
    value = int(sys.stdin.readline())
    print(solve(value))

if __name__ == "__main__":
    main()
`;
    const result = detectTargetInterface(source, 'python', 'function');
    expect(result.ok).toBe(true);
    expect(result.mappings.map((item) => item.name)).toEqual(['solve', 'main']);
    expect(result.maskedSource).toContain('if __name__ == "__main__":');
    expect(restoreTargetInterface(result.maskedSource, result.mappings)).toBe(source);
    expect(isTargetInterfaceUnchanged(source.replace('pass', 'return value + 1'), 'python', result)).toBe(true);
    expect(isTargetInterfaceUnchanged(source.replace('value: int', 'value: str'), 'python', result)).toBe(false);
    expect(isTargetInterfaceUnchanged(source.slice(0, source.indexOf('if __name__')), 'python', result)).toBe(false);
    expect(isTargetInterfaceUnchanged(source.replace('    main()\n', '    solve(0)\n'), 'python', result)).toBe(false);
    expect(isTargetInterfaceUnchanged(source.replace('    main()\n', 'main()\n'), 'python', result)).toBe(false);
  });

  it('忽略注释、字符串、类方法和嵌套函数中的伪入口', () => {
    const python = `"""
def fake():
    pass
"""
class Helper:
    def method(self): pass
def solve(
    value: int,
) -> int:
    def nested(): return 1
    return value
`;
    const result = detectTargetInterface(python, 'python', 'function');
    expect(result.mappings.map((item) => item.name)).toEqual(['solve']);
    expect(isTargetInterfaceUnchanged(python.replace('return value', 'return nested()'), 'python', result)).toBe(true);
    const cpp = '// int fake() {} \nclass Helper { public: int method() { return 0; } };\nint solve(int x) { return x; }';
    expect(detectTargetInterface(cpp, 'cpp', 'function').mappings.map((item) => item.name)).toEqual(['solve']);
  });

  it('识别 Python 单行函数、字符串默认值和 CRLF', () => {
    const source = 'def solve(value: str = ":") -> str: return value\r\n\r\nprint(solve())\r\n';
    const result = detectTargetInterface(source, 'python', 'function');
    expect(result.ok).toBe(true);
    expect(isTargetInterfaceUnchanged(source.replace('return value', 'return value * 2'), 'python', result)).toBe(true);
    expect(isTargetInterfaceUnchanged(source.replace('= ":"', '= "?"'), 'python', result)).toBe(false);
    expect(detectTargetInterface('class Solution:\n    def solve(self, x): return x', 'python').ok).toBe(true);
  });

  it('拒绝没有命名函数的脚本及不完整的 C++ 框架', () => {
    expect(detectTargetInterface('print(input())', 'python', 'function').ok).toBe(false);
    expect(detectTargetInterface('int main() {', 'cpp', 'function').ok).toBe(false);
    expect(detectTargetInterface('', 'cpp', 'function').ok).toBe(false);
    expect(detectTargetInterface('int main() {}', 'cpp').ok).toBe(false);
  });
});

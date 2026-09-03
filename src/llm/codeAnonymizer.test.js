import { describe, expect, it } from 'vitest';
import {
  MASKED_FUNCTION,
  detectTargetFunction,
  isConfirmedTargetUnchanged,
  replaceIdentifier,
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
});

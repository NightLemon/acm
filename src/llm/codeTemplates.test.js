import { describe, expect, it } from 'vitest';
import codeTemplates from '../../data/code-templates.json';
import { detectTargetFunction, detectTargetInterface } from './codeAnonymizer.js';

describe('official code templates', () => {
  it('包含课程题目的 C++ 与 Python 模板', () => {
    expect(Object.keys(codeTemplates).length).toBeGreaterThan(3000);
    for (const template of Object.values(codeTemplates)) {
      expect(typeof template.cpp === 'string' || template.cpp === null).toBe(true);
      expect(typeof template.python === 'string' || template.python === null).toBe(true);
      expect(Boolean(template.cpp || template.python)).toBe(true);
    }
  });

  it('包含课程之外的新题官方模板', () => {
    expect(codeTemplates['4000'].cpp).toContain('class Solution');
    expect(codeTemplates['4000'].python).toContain('class Solution');
  });

  it('第 33 题自动载入预期接口并可脱敏', () => {
    expect(codeTemplates['33'].cpp).toBe([
      'class Solution {',
      'public:',
      '    int search(vector<int>& nums, int target) {',
      '        ',
      '    }',
      '};',
    ].join('\n'));
    expect(codeTemplates['33'].python).toContain('def search(self, nums: list[int], target: int) -> int:');
    expect(detectTargetFunction(codeTemplates['33'].cpp, 'cpp')).toMatchObject({
      ok: true,
      targetName: 'search',
    });
  });

  it('第 146 题多方法设计模板可脱敏', () => {
    expect(detectTargetInterface(codeTemplates['146'].cpp, 'cpp')).toMatchObject({
      ok: true,
      kind: 'design-class',
      className: 'LRUCache',
    });
  });
});

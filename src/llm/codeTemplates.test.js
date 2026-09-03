import { describe, expect, it } from 'vitest';
import codeTemplates from '../../data/code-templates.json';
import { detectTargetFunction } from './codeAnonymizer.js';

describe('official code templates', () => {
  it('包含课程题目的 C++ 与 Python 模板', () => {
    expect(Object.keys(codeTemplates).length).toBeGreaterThan(190);
    for (const template of Object.values(codeTemplates)) {
      expect(typeof template.cpp).toBe('string');
      expect(typeof template.python).toBe('string');
    }
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
    expect(codeTemplates['33'].python).toContain('def search(self, nums: List[int], target: int) -> int:');
    expect(detectTargetFunction(codeTemplates['33'].cpp, 'cpp')).toMatchObject({
      ok: true,
      targetName: 'search',
    });
  });
});

import { describe, expect, it } from 'vitest';
import leetcodeIndex from '../data/leetcode-index.json';
import libraryTemplate from '../public/problem-library-template.json';
import {
  LibraryValidationError,
  hydrateLibrary,
  uniqueProblemIds,
  validateAndNormalizeLibrary,
} from './libraryData.js';

const index = {
  1: { id: '1', title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', paidOnly: false, tags: ['Array'] },
  49: { id: '49', title: 'Group Anagrams', slug: 'group-anagrams', difficulty: 'Medium', paidOnly: false, tags: ['Hash Table'] },
  70: { id: '70', title: 'Climbing Stairs', slug: 'climbing-stairs', difficulty: 'Easy', paidOnly: false, tags: ['DP'] },
};

const minimal = {
  schemaVersion: 1,
  id: 'my-list',
  name: 'My List',
  groups: [{ name: 'Array', problems: [1, '49'] }],
};

describe('validateAndNormalizeLibrary', () => {
  it('keeps the downloadable full example importable against the deployed LeetCode index', () => {
    const library = validateAndNormalizeLibrary(libraryTemplate, leetcodeIndex);
    const hydrated = hydrateLibrary(library, leetcodeIndex);

    expect(hydrated.groups.flatMap((group) => group.problems).map((problem) => problem.id))
      .toEqual(['1', '121', '49', '15', '70', '198']);
    expect(hydrated.groups[0].problems[2]).toMatchObject({
      title: 'Group Anagrams',
      tier: 'core',
      est: 25,
    });
    expect(hydrated.groups[1].problems[0]).toMatchObject({ tier: undefined, est: 30 });
  });

  it('accepts numeric and string ids while preserving order', () => {
    const library = validateAndNormalizeLibrary(minimal, index);
    expect(library.groups[0].problems).toEqual([
      { source: 'leetcode', id: '1', url: 'https://leetcode.com/problems/two-sum/' },
      { source: 'leetcode', id: '49', url: 'https://leetcode.com/problems/group-anagrams/' },
    ]);
    expect(library.description).toBe('');
  });

  it('accepts optional guidance fields', () => {
    const library = validateAndNormalizeLibrary({
      ...minimal,
      groups: [{
        name: 'Array',
        problems: [{ id: '49', tier: 'core', est: 25, idea: 'hash', pitfall: 'order', variants: ['sort'] }],
      }],
    }, index);
    expect(library.groups[0].problems[0]).toEqual({
      source: 'leetcode', id: '49', url: 'https://leetcode.com/problems/group-anagrams/',
      tier: 'core', est: 25, idea: 'hash', pitfall: 'order', variants: ['sort'],
    });
  });

  it('resolves a problem id from a leetcode.com URL alone', () => {
    const library = validateAndNormalizeLibrary({
      ...minimal,
      groups: [{
        name: 'Array',
        problems: [{
          source: 'leetcode',
          url: 'https://leetcode.com/problems/group-anagrams/description/?envType=study-plan',
        }],
      }],
    }, index);
    expect(library.groups[0].problems[0]).toEqual({
      source: 'leetcode',
      id: '49',
      url: 'https://leetcode.com/problems/group-anagrams/',
    });
  });

  it('validates explicit sources and checks that URLs match the LeetCode problem id', () => {
    expect(() => validateAndNormalizeLibrary({
      ...minimal,
      groups: [{
        name: 'Array',
        problems: [{ source: 'codeforces', id: '1', url: 'https://leetcode.cn/problems/group-anagrams/' }],
      }],
    }, index)).toThrow(/当前只支持 leetcode/);

    expect(() => validateAndNormalizeLibrary({
      ...minimal,
      groups: [{
        name: 'Array',
        problems: [{ source: 'leetcode', id: '1', url: 'https://leetcode.cn/problems/group-anagrams/' }],
      }],
    }, index)).toThrow(/与题号 1 不匹配/);

    expect(() => validateAndNormalizeLibrary({
      ...minimal,
      groups: [{
        name: 'Array',
        problems: [{ source: 'leetcode', url: 'https://example.com/problems/two-sum/' }],
      }],
    }, index)).toThrow(/必须是 leetcode.com/);
  });

  it('reports paths for invalid version, unknown ids, duplicates, html and unknown fields', () => {
    expect(() => validateAndNormalizeLibrary({
      schemaVersion: 2,
      id: 'bad-list',
      name: '<b>Bad</b>',
      extra: true,
      groups: [{ name: 'Array', problems: ['999', '999'] }],
    }, index)).toThrowError(LibraryValidationError);
    try {
      validateAndNormalizeLibrary({
        schemaVersion: 2,
        id: 'bad-list',
        name: '<b>Bad</b>',
        extra: true,
        groups: [{ name: 'Array', problems: ['999', '999'] }],
      }, index);
    } catch (error) {
      expect(error.message).toContain('$.schemaVersion');
      expect(error.message).toContain('$.extra');
      expect(error.message).toContain('HTML');
      expect(error.message).toContain('LeetCode 题号 999 不存在');
      expect(error.message).toContain('当前分组中重复');
    }
  });
});

describe('hydrateLibrary', () => {
  it('uses canonical metadata and defaults estimate to 30 minutes', () => {
    const hydrated = hydrateLibrary(validateAndNormalizeLibrary(minimal, index), index);
    expect(hydrated.groups[0].problems[0]).toMatchObject({
      id: '1', title: 'Two Sum', difficulty: 'Easy', tags: ['Array'], est: 30,
      url: 'https://leetcode.com/problems/two-sum/',
    });
  });

  it('counts duplicated problems once across groups', () => {
    const hydrated = hydrateLibrary(validateAndNormalizeLibrary({
      ...minimal,
      groups: [
        { name: 'A', problems: ['1', '49'] },
        { name: 'B', problems: ['1', '70'] },
      ],
    }, index), index);
    expect(uniqueProblemIds(hydrated)).toEqual(['1', '49', '70']);
  });
});

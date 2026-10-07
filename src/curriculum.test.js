import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import curriculum from '../data/curriculum.json';
import interview from '../data/raw/interview.json';
import index from '../data/leetcode-index.json';
import templates from '../data/code-templates.json';
import manifest from '../public/statements/manifest.json';
import { createBuiltinLibrary, uniqueProblemIds } from './libraryData.js';
import { detectTargetInterface } from './llm/codeAnonymizer.js';

describe('interview practice expansion', () => {
  it('adds exactly 72 new free problems in 10 groups without changing old problem ids', () => {
    const additions = interview.days.flatMap((day) => day.problems);
    const ids = additions.map((problem) => problem.id);
    const previous = [...curriculum.algoDays.filter((day) => day.day < 30), ...curriculum.mock.days]
      .flatMap((day) => day.problems.map((problem) => problem.id));
    expect(interview.days).toHaveLength(10);
    expect(ids).toHaveLength(72);
    expect(new Set(ids).size).toBe(72);
    expect(ids.filter((id) => previous.includes(id))).toEqual([]);
    for (const problem of additions) {
      expect(index[problem.id].paidOnly).toBe(false);
      expect(templates[problem.id].cpp).toBeTruthy();
      expect(templates[problem.id].python).toBeTruthy();
      expect(problem.idea).toBeTruthy();
      expect(problem.pitfall).toBeTruthy();
      expect(problem.est).toBeGreaterThan(0);
    }
  });

  it('includes all new groups and canonical metadata in the rendered builtin library', () => {
    const library = createBuiltinLibrary(curriculum);
    const allIds = uniqueProblemIds(library);
    for (const day of interview.days) {
      const group = library.groups.find((item) => item.name === day.title);
      expect(group.problems.map((problem) => problem.id)).toEqual(day.problems.map((problem) => problem.id));
      for (const problem of group.problems) {
        const canonical = index[problem.id];
        expect(allIds).toContain(problem.id);
        expect(problem).toMatchObject({
          title: canonical.title,
          difficulty: canonical.difficulty,
          slug: canonical.slug,
          url: `https://leetcode.com/problems/${canonical.slug}/`,
        });
      }
    }
  });

  it.each(interview.days.flatMap((day) => day.problems))('ships a nonempty statement and manifest entry for $id', ({ id }) => {
    const statement = JSON.parse(readFileSync(new URL(`../public/statements/${id}.json`, import.meta.url), 'utf8'));
    expect(manifest.ids).toContain(id);
    expect(statement.id).toBe(id);
    expect(statement.slug).toBe(index[id].slug);
    expect(statement.content).toBeTruthy();
  });

  it('continues detecting official C++ and Python interfaces for both old and new problems', () => {
    for (const id of uniqueProblemIds(createBuiltinLibrary(curriculum))) {
      for (const language of ['cpp', 'python']) {
        expect(detectTargetInterface(templates[id][language], language).ok, `${id} ${language}`).toBe(true);
      }
    }
  });
});

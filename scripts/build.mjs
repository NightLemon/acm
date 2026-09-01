// Merge authored curriculum fragments -> data/curriculum.json
// Validates EVERY problem id against the canonical LeetCode index.
// Any id not present in the index is a hard failure: fabricated ids must never ship.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const idx = JSON.parse(readFileSync(join(ROOT, 'data/leetcode-index.json'), 'utf8'));

const read = f => JSON.parse(readFileSync(join(ROOT, 'data/raw', f), 'utf8'));

const problems = [];   // flat, deduped-by-day list
const errors = [];
const warnings = [];

function normProblem(p, ctx) {
  const meta = idx[String(p.id)];
  if (!meta) {
    errors.push(`${ctx}: id ${p.id} ("${p.title || '?'}") does not exist in LeetCode index`);
    return null;
  }
  // Title drift check — authored title must match canonical, else we silently mislabel.
  if (p.title && p.title.trim() !== meta.title) {
    warnings.push(`${ctx}: id ${p.id} title mismatch. authored="${p.title}" canonical="${meta.title}" (using canonical)`);
  }
  return {
    id: meta.id,
    title: meta.title,          // always canonical
    cn: p.cn || '',
    slug: meta.slug,
    difficulty: meta.difficulty,
    paidOnly: meta.paidOnly,
    tags: meta.tags,
    tier: p.tier === 'core' ? 'core' : 'optional',
    est: Number.isFinite(p.est) ? p.est : 30,
    idea: p.idea || '',
    pitfall: p.pitfall || '',
    variants: Array.isArray(p.variants) ? p.variants : [],
    url: `https://leetcode.cn/problems/${meta.slug}/`,
    urlEn: `https://leetcode.com/problems/${meta.slug}/`,
  };
}

// ---- algorithm days (weeks 1-3) ----
const algoDays = [];
for (const [file, week] of [['week1.json', 1], ['week2.json', 2], ['week3.json', 3]]) {
  const path = join(ROOT, 'data/raw', file);
  if (!existsSync(path)) { errors.push(`missing fragment: ${file}`); continue; }
  const frag = read(file);
  for (const d of frag.days) {
    const seen = new Set();
    const list = [];
    for (const p of d.problems || []) {
      const n = normProblem(p, `${file} day${d.day}`);
      if (!n) continue;
      if (seen.has(n.id)) { warnings.push(`${file} day${d.day}: duplicate id ${n.id} dropped`); continue; }
      seen.add(n.id);
      list.push(n);
    }
    algoDays.push({ week, day: d.day, title: d.title || '', focus: d.focus || '', drill: d.drill || '', problems: list });
    problems.push(...list.map(p => ({ ...p, day: d.day, week })));
  }
}

// ---- system design ----
let design = { framework: { steps: [], cheatsheet: [] }, components: [], designs: [], week4: [] };
if (existsSync(join(ROOT, 'data/raw/design.json'))) design = read('design.json');
else errors.push('missing fragment: design.json');

// ---- week4 mock + fundamentals + handwritten ----
let extra = { mock: { days: [], strategy: {} }, fundamentals: { cpp: [], python: [], common: [] }, handwritten: [] };
if (existsSync(join(ROOT, 'data/raw/week4.json'))) extra = read('week4.json');
else errors.push('missing fragment: week4.json');

// Authors may emit `mockDays` at the top level instead of `mock.days`.
if (!extra.mock && Array.isArray(extra.mockDays)) extra.mock = { days: extra.mockDays };
if (!extra.mock) extra.mock = { days: [] };
if (!Array.isArray(extra.mock.days)) extra.mock.days = [];

// Mock-day problems must be validated exactly like curriculum problems.
for (const d of extra.mock.days) {
  const list = [];
  for (const p of d.problems || []) {
    const n = normProblem(p, `week4.json mock day${d.day}`);
    if (n) list.push(n);
  }
  d.problems = list;
}

// handwritten items may carry a leetcode id — validate those too
for (const h of extra.handwritten || []) {
  if (h.lcId != null && !idx[String(h.lcId)]) {
    errors.push(`handwritten "${h.name}": lcId ${h.lcId} does not exist`);
    h.lcId = null;
  } else if (h.lcId != null) {
    h.lcTitle = idx[String(h.lcId)].title;
    h.url = `https://leetcode.cn/problems/${idx[String(h.lcId)].slug}/`;
  }
}

algoDays.sort((a, b) => a.day - b.day);

// Paid-only problems have no fetchable statement, so flag them across every
// surface the app renders — mock days included, not just the algo weeks.
const allShown = [
  ...problems,
  ...(extra.mock?.days || []).flatMap(d => d.problems || []),
];

const stats = {
  totalProblems: problems.length,
  uniqueProblems: new Set(problems.map(p => p.id)).size,
  core: problems.filter(p => p.tier === 'core').length,
  optional: problems.filter(p => p.tier === 'optional').length,
  byDifficulty: problems.reduce((a, p) => (a[p.difficulty] = (a[p.difficulty] || 0) + 1, a), {}),
  paidOnly: [...new Set(allShown.filter(p => p.paidOnly).map(p => p.id))],
  totalMinutes: problems.reduce((a, p) => a + p.est, 0),
};

const out = { generatedAt: null, stats, algoDays, design, mock: extra.mock, fundamentals: extra.fundamentals, handwritten: extra.handwritten };

if (warnings.length) {
  console.warn(`\n⚠ ${warnings.length} warning(s):`);
  for (const w of warnings) console.warn('  ' + w);
}
if (errors.length) {
  console.error(`\n✗ ${errors.length} ERROR(S) — build aborted:`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}

writeFileSync(join(ROOT, 'data/curriculum.json'), JSON.stringify(out, null, 1));
console.log('\n✓ build ok');
console.log(`  days: ${algoDays.length}`);
console.log(`  problems: ${stats.totalProblems} (unique ${stats.uniqueProblems}) core=${stats.core} optional=${stats.optional}`);
console.log(`  difficulty:`, stats.byDifficulty);
console.log(`  paid-only: ${stats.paidOnly.length ? stats.paidOnly.join(',') : 'none'}`);
console.log(`  est total: ${Math.round(stats.totalMinutes / 60)}h`);
const designCases = design.cases?.length || design.designs?.length || 0;
console.log(`  design: ${design.frameworks?.length || 0} frameworks, ${design.components?.length || 0} components, ${designCases} cases`);
console.log(`  mock: ${extra.mock?.days?.length || 0} days, handwritten: ${extra.handwritten?.length || 0}`);

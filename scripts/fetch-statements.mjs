// Fetches full problem statements (description + examples + constraints) for every
// problem referenced by the curriculum, one JSON file per problem under
// public/statements/. The app lazy-loads these at runtime, so partial data is fine:
// a problem whose fetch failed simply falls back to the LeetCode link.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/statements');
const EN = 'https://leetcode.com/graphql';
const CN = 'https://leetcode.cn/graphql';

const FORCE = process.argv.includes('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The statement HTML is injected into the DOM, so strip anything executable even
// though the source is LeetCode's own API. Cheap insurance, done once at fetch time.
function sanitize(html) {
  if (!html) return null;
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<(object|embed|link|meta|base|form)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

async function gql(url, query, variables, attempt = 0, maxAttempts = 4) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Referer: url.replace('/graphql', ''),
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0]?.message || 'graphql error');
    return json.data;
  } catch (e) {
    if (attempt >= maxAttempts) throw e;
    await sleep(600 * (attempt + 1));
    return gql(url, query, variables, attempt + 1, maxAttempts);
  }
}

const Q_EN = `query q($slug: String!) {
  question(titleSlug: $slug) {
    questionFrontendId title titleSlug difficulty content hints sampleTestCase
    topicTags { name }
  }
}`;

const Q_CN = `query q($slug: String!) {
  question(titleSlug: $slug) { translatedTitle translatedContent }
}`;

async function main() {
  const curriculum = JSON.parse(readFileSync(join(ROOT, 'data/curriculum.json'), 'utf8'));
  const index = JSON.parse(readFileSync(join(ROOT, 'data/leetcode-index.json'), 'utf8'));

  // Collect every problem id the app can display, algo days and mock days alike.
  const ids = new Set();
  for (const d of curriculum.algoDays || []) for (const p of d.problems || []) ids.add(p.id);
  for (const d of curriculum.mock?.days || []) for (const p of d.problems || []) ids.add(p.id);
  for (const h of curriculum.handwritten || []) if (h.lcId) ids.add(h.lcId);

  mkdirSync(OUT, { recursive: true });
  const have = new Set(
    existsSync(OUT) ? readdirSync(OUT).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : []
  );

  const todo = [...ids].filter((id) => FORCE || !have.has(id));
  console.log(`statements: ${ids.size} referenced, ${have.size} cached, ${todo.length} to fetch`);

  let ok = 0;
  let cnOk = 0, cnFail = 0, skipCn = false;
  const failed = [];

  for (let i = 0; i < todo.length; i++) {
    const id = todo[i];
    const meta = index[id];
    if (!meta) { failed.push(`${id} (not in index)`); continue; }

    try {
      const en = await gql(EN, Q_EN, { slug: meta.slug });
      const q = en?.question;
      if (!q?.content) throw new Error('empty content');

      // Chinese translation is best-effort: leetcode.cn sits behind a WAF that
      // usually rejects us, so try once and move on rather than burning retries.
      let cn = null, cnTitle = null;
      if (!skipCn) {
        try {
          const r = await gql(CN, Q_CN, { slug: meta.slug }, 0, 0);
          cn = sanitize(r?.question?.translatedContent);
          cnTitle = r?.question?.translatedTitle || null;
          if (cn) cnOk++;
        } catch {
          cnFail++;
          // After enough consecutive rejections, stop asking entirely.
          if (cnFail >= 8 && cnOk === 0) {
            skipCn = true;
            console.log('  (leetcode.cn unreachable — continuing with English only)');
          }
        }
      }

      writeFileSync(
        join(OUT, `${id}.json`),
        JSON.stringify({
          id,
          slug: meta.slug,
          title: q.title,
          titleCn: cnTitle,
          difficulty: q.difficulty,
          tags: (q.topicTags || []).map((t) => t.name),
          content: sanitize(q.content),
          contentCn: cn,
          hints: q.hints || [],
          sampleTestCase: q.sampleTestCase || null,
        })
      );
      ok++;
      const cnMark = cn ? 'cn' : '--';
      console.log(`  [${i + 1}/${todo.length}] ${id} ${q.title} (${cnMark})`);
    } catch (e) {
      failed.push(`${id} ${meta.slug}: ${e.message}`);
      console.log(`  [${i + 1}/${todo.length}] ${id} FAILED: ${e.message}`);
    }
    await sleep(260);
  }

  // A manifest lets the UI know what exists without probing for 404s.
  const all = readdirSync(OUT).filter((f) => f.endsWith('.json') && f !== 'manifest.json');
  writeFileSync(
    join(OUT, 'manifest.json'),
    JSON.stringify({ ids: all.map((f) => f.slice(0, -5)).sort() })
  );

  console.log(`\n✓ fetched ${ok}, total on disk ${all.length}/${ids.size}`);
  if (failed.length) {
    console.log(`✗ ${failed.length} failed:`);
    for (const f of failed) console.log('   ' + f);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

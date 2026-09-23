// Fetch canonical LeetCode metadata and official C++/Python answer templates.
import { writeFileSync } from 'node:fs';

const ENDPOINT = 'https://leetcode.com/graphql';
const QUERY = `query problemsetQuestionList($categorySlug:String,$limit:Int,$skip:Int,$filters:QuestionListFilterInput){
  problemsetQuestionList:questionList(categorySlug:$categorySlug,limit:$limit,skip:$skip,filters:$filters){
    total:totalNum
    questions:data{
      questionFrontendId title titleSlug difficulty paidOnly:isPaidOnly
      topicTags{ name slug }
      codeSnippets{ langSlug code }
    }
  }
}`;

const PAGE = 100;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function page(skip) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ query: QUERY, variables: { categorySlug: '', limit: PAGE, skip, filters: {} } }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 200));
      return json.data.problemsetQuestionList;
    } catch (e) {
      if (attempt === 5) throw e;
      console.error(`  retry ${attempt} @skip=${skip}: ${e.message}`);
      await sleep(1500 * attempt);
    }
  }
}

const first = await page(0);
const total = first.total;
const all = [...first.questions];
console.log(`total=${total}`);

for (let skip = PAGE; skip < total; skip += PAGE) {
  const p = await page(skip);
  all.push(...p.questions);
  process.stdout.write(`\rfetched ${all.length}/${total}`);
  await sleep(220);
}
console.log('');

const byId = {};
const templates = {};
for (const q of all) {
  byId[q.questionFrontendId] = {
    id: q.questionFrontendId,
    title: q.title,
    slug: q.titleSlug,
    difficulty: q.difficulty,
    paidOnly: q.paidOnly,
    tags: q.topicTags.map(t => t.name),
  };
  const snippets = Object.fromEntries(
    (q.codeSnippets || []).map((snippet) => [snippet.langSlug, snippet.code])
  );
  const cpp = snippets.cpp || null;
  const python = snippets.python3 || snippets.python || null;
  if (cpp || python) templates[q.questionFrontendId] = { cpp, python };
}
writeFileSync(new URL('../data/leetcode-index.json', import.meta.url), JSON.stringify(byId, null, 0));
writeFileSync(new URL('../data/code-templates.json', import.meta.url), JSON.stringify(templates));
console.log(`wrote ${Object.keys(byId).length} problems and ${Object.keys(templates).length} code templates`);

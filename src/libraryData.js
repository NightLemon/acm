export const BUILTIN_LIBRARY_ID = 'builtin-acm';

const LIBRARY_ID_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const HTML_RE = /<\s*\/?\s*[a-z][^>]*>/i;
const ROOT_KEYS = new Set(['schemaVersion', 'id', 'name', 'description', 'groups']);
const GROUP_KEYS = new Set(['name', 'description', 'problems']);
const PROBLEM_KEYS = new Set(['source', 'id', 'url', 'tier', 'est', 'idea', 'pitfall', 'variants']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function addUnknownKeyErrors(value, allowed, path, errors) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${path}.${key}: 不支持的字段`);
  }
}

function textField(value, path, errors, { required = false, max = 10000 } = {}) {
  if (value == null && !required) return '';
  if (typeof value !== 'string') {
    errors.push(`${path}: 必须是字符串`);
    return '';
  }
  const text = value.trim();
  if (required && !text) errors.push(`${path}: 不能为空`);
  if (text.length > max) errors.push(`${path}: 不能超过 ${max} 个字符`);
  if (HTML_RE.test(text)) errors.push(`${path}: 不能包含 HTML 标签`);
  return text;
}

function problemId(value, path, errors) {
  if (!['string', 'number'].includes(typeof value)) {
    errors.push(`${path}: 题号必须是字符串或数字`);
    return '';
  }
  const id = String(value).trim();
  if (!/^\d+$/.test(id) || id === '0') errors.push(`${path}: 必须是有效的 LeetCode 数字题号`);
  return id;
}

function parseSourceUrl(value, path, errors) {
  if (value == null) return null;
  const text = textField(value, path, errors, { required: true, max: 500 });
  if (!text) return null;

  try {
    const parsed = new URL(text);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathName = parsed.pathname.replace(/\/+$/, '');
    const match = /^\/problems\/([^/]+)(?:\/description)?$/.exec(pathName);
    if (parsed.protocol !== 'https:' || !['leetcode.com', 'leetcode.cn'].includes(host)) {
      errors.push(`${path}: 必须是 leetcode.com 的 HTTPS 链接`);
      return null;
    }
    if (!match) {
      errors.push(`${path}: 路径必须是 /problems/<题目-slug>/`);
      return null;
    }
    return {
      slug: match[1],
      url: `https://leetcode.com/problems/${match[1]}/`,
    };
  } catch {
    errors.push(`${path}: 必须是有效的 URL`);
    return null;
  }
}

export class LibraryValidationError extends Error {
  constructor(errors) {
    super(errors.join('\n'));
    this.name = 'LibraryValidationError';
    this.errors = errors;
  }
}

/** Validate an imported library and strip it down to the persisted public shape. */
export function validateAndNormalizeLibrary(input, index) {
  const errors = [];
  if (!isObject(input)) throw new LibraryValidationError(['$: 根节点必须是 JSON 对象']);

  addUnknownKeyErrors(input, ROOT_KEYS, '$', errors);
  if (input.schemaVersion !== 1) errors.push('$.schemaVersion: 当前只支持版本 1');

  const id = textField(input.id, '$.id', errors, { required: true, max: 64 });
  if (id && !LIBRARY_ID_RE.test(id)) {
    errors.push('$.id: 只能包含小写字母、数字、下划线和连字符，长度为 2–64');
  }
  if (id === BUILTIN_LIBRARY_ID) errors.push(`$.id: “${BUILTIN_LIBRARY_ID}” 为内置题库保留 ID`);

  const name = textField(input.name, '$.name', errors, { required: true, max: 80 });
  const description = textField(input.description, '$.description', errors, { max: 2000 });

  if (!Array.isArray(input.groups) || input.groups.length === 0) {
    errors.push('$.groups: 必须是非空数组');
  }

  const indexBySlug = index
    ? new Map(Object.values(index).map((meta) => [meta.slug, meta]))
    : null;
  const groups = Array.isArray(input.groups) ? input.groups.map((group, groupIndex) => {
    const groupPath = `$.groups[${groupIndex}]`;
    if (!isObject(group)) {
      errors.push(`${groupPath}: 必须是对象`);
      return { name: '', description: '', problems: [] };
    }
    addUnknownKeyErrors(group, GROUP_KEYS, groupPath, errors);
    const groupName = textField(group.name, `${groupPath}.name`, errors, { required: true, max: 80 });
    const groupDescription = textField(group.description, `${groupPath}.description`, errors, { max: 2000 });
    if (!Array.isArray(group.problems) || group.problems.length === 0) {
      errors.push(`${groupPath}.problems: 必须是非空数组`);
    }

    const seen = new Set();
    const problems = Array.isArray(group.problems) ? group.problems.map((item, problemIndex) => {
      const itemPath = `${groupPath}.problems[${problemIndex}]`;
      const objectItem = isObject(item);
      if (objectItem) addUnknownKeyErrors(item, PROBLEM_KEYS, itemPath, errors);
      const parsedUrl = parseSourceUrl(objectItem ? item.url : null, `${itemPath}.url`, errors);
      const idValue = objectItem ? item.id : item;
      let normalizedId = '';
      if (idValue != null) {
        normalizedId = problemId(idValue, objectItem ? `${itemPath}.id` : itemPath, errors);
      } else if (parsedUrl?.slug && indexBySlug?.has(parsedUrl.slug)) {
        normalizedId = String(indexBySlug.get(parsedUrl.slug).id);
      } else {
        errors.push(`${itemPath}: id 或有效的 LeetCode url 至少提供一个`);
      }

      if (normalizedId && seen.has(normalizedId)) errors.push(`${itemPath}: 题号 ${normalizedId} 在当前分组中重复`);
      seen.add(normalizedId);
      const meta = normalizedId && index ? index[normalizedId] : null;
      if (normalizedId && index && !meta) errors.push(`${itemPath}: LeetCode 题号 ${normalizedId} 不存在`);
      if (parsedUrl?.slug && meta && parsedUrl.slug !== meta.slug) {
        errors.push(`${itemPath}.url: 与题号 ${meta.id} 不匹配，题目 slug 应为 ${meta.slug}`);
      }
      if (!normalizedId && parsedUrl?.slug && indexBySlug && !indexBySlug.has(parsedUrl.slug)) {
        errors.push(`${itemPath}.url: LeetCode 题目 ${parsedUrl.slug} 不存在`);
      }

      const source = objectItem && item.source != null
        ? textField(item.source, `${itemPath}.source`, errors, { required: true, max: 30 })
        : 'leetcode';
      if (source && source !== 'leetcode') errors.push(`${itemPath}.source: 当前只支持 leetcode`);
      const url = meta
        ? `https://leetcode.com/problems/${meta.slug}/`
        : parsedUrl?.url || '';
      const normalized = { source, id: normalizedId, url };
      if (!objectItem) return normalized;

      if (item.tier != null) {
        if (!['core', 'optional'].includes(item.tier)) errors.push(`${itemPath}.tier: 只能是 core 或 optional`);
        else normalized.tier = item.tier;
      }
      if (item.est != null) {
        if (!Number.isFinite(item.est) || item.est < 1 || item.est > 600) {
          errors.push(`${itemPath}.est: 必须是 1–600 之间的分钟数`);
        } else normalized.est = item.est;
      }
      for (const key of ['idea', 'pitfall']) {
        if (item[key] != null) normalized[key] = textField(item[key], `${itemPath}.${key}`, errors);
      }
      if (item.variants != null) {
        if (!Array.isArray(item.variants)) errors.push(`${itemPath}.variants: 必须是字符串数组`);
        else normalized.variants = item.variants.map((variant, variantIndex) =>
          textField(variant, `${itemPath}.variants[${variantIndex}]`, errors, { max: 1000 })
        );
      }
      return normalized;
    }) : [];

    return { name: groupName, description: groupDescription, problems };
  }) : [];

  if (errors.length) throw new LibraryValidationError(errors.slice(0, 50));
  return { schemaVersion: 1, id, name, description, groups };
}

export function hydrateLibrary(library, index) {
  return {
    ...library,
    groups: library.groups.map((group) => ({
      ...group,
      problems: group.problems.map((problem) => {
        const meta = index[String(problem.id)];
        if (!meta) throw new LibraryValidationError([`LeetCode 题号 ${problem.id} 不存在`]);
        return {
          source: problem.source || 'leetcode',
          id: String(meta.id),
          title: meta.title,
          cn: '',
          slug: meta.slug,
          difficulty: meta.difficulty,
          paidOnly: !!meta.paidOnly,
          tags: Array.isArray(meta.tags) ? meta.tags : [],
          tier: problem.tier,
          est: problem.est ?? 30,
          idea: problem.idea || '',
          pitfall: problem.pitfall || '',
          variants: problem.variants || [],
          url: problem.url || `https://leetcode.com/problems/${meta.slug}/`,
          urlEn: `https://leetcode.com/problems/${meta.slug}/`,
        };
      }),
    })),
  };
}

export function createBuiltinLibrary(curriculum) {
  const withSource = (problems) => (problems || []).map((problem) => ({
    ...problem,
    source: problem.source || 'leetcode',
    url: problem.urlEn || problem.url,
  }));
  const algorithmGroups = (curriculum.algoDays || []).map((day) => ({
    name: day.title || `专题 ${day.day}`,
    description: day.focus || day.drill || '',
    problems: withSource(day.problems),
  }));
  const mockGroups = (curriculum.mock?.days || []).map((day) => ({
    name: day.title || `综合训练 ${day.day}`,
    description: day.focus || day.style || '',
    problems: withSource(day.problems),
  }));
  return {
    schemaVersion: 1,
    id: BUILTIN_LIBRARY_ID,
    name: 'ACM 默认题库',
    description: '由项目原有算法训练内容转换而成，可直接刷题，也可导入自己的 JSON 题库。',
    builtin: true,
    groups: [...algorithmGroups, ...mockGroups],
  };
}

export function uniqueProblemIds(library) {
  return [...new Set((library?.groups || []).flatMap((group) => group.problems || []).map((problem) => String(problem.id)))];
}

export const MASKED_FUNCTION = '__TARGET_FUNCTION__';

const identifierPattern = (name) => new RegExp(
  `(?<![A-Za-z0-9_])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`,
  'g'
);

export function replaceIdentifier(text, name, replacement = MASKED_FUNCTION) {
  if (!text || !name) return text || '';
  return text.replace(identifierPattern(name), replacement);
}

export function restoreIdentifier(text, name) {
  return replaceIdentifier(text, MASKED_FUNCTION, name);
}

function stripCppCommentsAndStrings(source) {
  let out = '';
  let state = 'code';
  let quote = '';

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (state === 'line-comment') {
      if (ch === '\n') { state = 'code'; out += '\n'; }
      else out += ' ';
      continue;
    }
    if (state === 'block-comment') {
      if (ch === '*' && next === '/') { out += '  '; i += 1; state = 'code'; }
      else out += ch === '\n' ? '\n' : ' ';
      continue;
    }
    if (state === 'string') {
      if (ch === '\\') { out += ' '; if (next !== undefined) { out += next === '\n' ? '\n' : ' '; i += 1; } }
      else if (ch === quote) { out += ' '; state = 'code'; }
      else out += ch === '\n' ? '\n' : ' ';
      continue;
    }

    if (ch === '/' && next === '/') { out += '  '; i += 1; state = 'line-comment'; }
    else if (ch === '/' && next === '*') { out += '  '; i += 1; state = 'block-comment'; }
    else if (ch === '"' || ch === "'") { out += ' '; quote = ch; state = 'string'; }
    else out += ch;
  }
  return out;
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function methodFromSegment(segment, isPublic) {
  const accessMatches = [...segment.matchAll(/\b(public|private|protected)\s*:/g)];
  let declaration = segment;
  let publicState = isPublic;
  if (accessMatches.length) {
    const last = accessMatches[accessMatches.length - 1];
    publicState = last[1] === 'public';
    declaration = segment.slice(last.index + last[0].length);
  }

  declaration = declaration.trim().replace(/;$/, '').trim();
  if (!publicState || !declaration || !declaration.includes('(')) {
    return { publicState, candidate: null };
  }

  const close = declaration.lastIndexOf(')');
  if (close < 0) return { publicState, candidate: null };
  let depth = 0;
  let open = -1;
  for (let i = close; i >= 0; i -= 1) {
    if (declaration[i] === ')') depth += 1;
    else if (declaration[i] === '(') {
      depth -= 1;
      if (depth === 0) { open = i; break; }
    }
  }
  if (open < 0) return { publicState, candidate: null };

  const before = declaration.slice(0, open).trim();
  const nameMatch = before.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
  if (!nameMatch) return { publicState, candidate: null };
  const name = nameMatch[1];
  if (name === 'Solution' || name === 'operator') return { publicState, candidate: null };

  return {
    publicState,
    candidate: {
      name,
      signature: declaration.replace(/\s+/g, ' ').trim(),
    },
  };
}

function cppCandidates(source) {
  const clean = stripCppCommentsAndStrings(source);
  const classMatch = /\bclass\s+Solution\b[^;{]*\{/.exec(clean);
  if (!classMatch) return [];
  const open = classMatch.index + classMatch[0].lastIndexOf('{');
  const close = findMatchingBrace(clean, open);
  if (close < 0) return [];

  const body = clean.slice(open + 1, close);
  const candidates = [];
  let depth = 0;
  let start = 0;
  let isPublic = false;

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '{') {
      if (depth === 0) {
        const parsed = methodFromSegment(body.slice(start, i), isPublic);
        isPublic = parsed.publicState;
        if (parsed.candidate) candidates.push(parsed.candidate);
      }
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) start = i + 1;
    } else if (ch === ';' && depth === 0) {
      const parsed = methodFromSegment(body.slice(start, i + 1), isPublic);
      isPublic = parsed.publicState;
      if (parsed.candidate) candidates.push(parsed.candidate);
      start = i + 1;
    }
  }

  return candidates;
}

function indentation(line) {
  return line.match(/^[ \t]*/)?.[0].replace(/\t/g, '    ').length || 0;
}

function pythonCandidates(source) {
  const lines = source.split(/\r?\n/);
  const classIndex = lines.findIndex((line) => /^\s*class\s+Solution\b[^:]*:\s*(?:#.*)?$/.test(line));
  if (classIndex < 0) return [];
  const classIndent = indentation(lines[classIndex]);
  const found = [];

  for (let i = classIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const indent = indentation(line);
    if (indent <= classIndent) break;
    const match = /^\s*(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:/.exec(line);
    if (match) found.push({ name: match[1], signature: line.trim().replace(/\s+/g, ' '), indent });
  }

  if (!found.length) return [];
  const memberIndent = Math.min(...found.map((item) => item.indent));
  return found
    .filter((item) => item.indent === memberIndent && item.name !== '__init__')
    .map(({ name, signature }) => ({ name, signature }));
}

export function listTargetCandidates(source, language) {
  if (!source?.trim()) return [];
  return language === 'python' ? pythonCandidates(source) : cppCandidates(source);
}

export function detectTargetFunction(source, language) {
  const candidates = listTargetCandidates(source, language);
  if (candidates.length !== 1) {
    return {
      ok: false,
      candidates,
      error: candidates.length === 0
        ? '没有识别到 class Solution 中的目标函数。请保留一个完整、单行声明的 public 方法。'
        : `识别到 ${candidates.length} 个候选函数（${candidates.map((item) => item.name).join('、')}）。请只保留一个 public 目标方法，helper 改为 private。`,
    };
  }

  const target = candidates[0];
  return {
    ok: true,
    targetName: target.name,
    signature: replaceIdentifier(target.signature, target.name),
    maskedSource: replaceIdentifier(source, target.name),
  };
}

export function isConfirmedTargetUnchanged(source, language, targetName, confirmedSignature) {
  const candidate = listTargetCandidates(source, language).find((item) => item.name === targetName);
  if (!candidate) return false;
  return replaceIdentifier(candidate.signature, targetName) === confirmedSignature;
}

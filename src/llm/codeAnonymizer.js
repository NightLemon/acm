export const MASKED_FUNCTION = '__TARGET_FUNCTION__';
export const MASKED_CLASS = '__TARGET_CLASS__';

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

export function maskTargetInterface(text, mappings = []) {
  return mappings.reduce(
    (result, mapping) => replaceIdentifier(result, mapping.name, mapping.placeholder),
    text || ''
  );
}

export function restoreTargetInterface(text, mappings = []) {
  return [...mappings].reverse().reduce(
    (result, mapping) => replaceIdentifier(result, mapping.placeholder, mapping.name),
    text || ''
  );
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
      if (ch === '\\') {
        out += ' ';
        if (next !== undefined) { out += next === '\n' ? '\n' : ' '; i += 1; }
      } else if (ch === quote) { out += ' '; state = 'code'; }
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

function methodFromSegment(segment, isPublic, className) {
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

  const open = declaration.indexOf('(');
  if (open < 0) return { publicState, candidate: null };
  let depth = 0;
  let close = -1;
  for (let i = open; i < declaration.length; i += 1) {
    if (declaration[i] === '(') depth += 1;
    else if (declaration[i] === ')') {
      depth -= 1;
      if (depth === 0) { close = i; break; }
    }
  }
  if (close < 0) return { publicState, candidate: null };

  const before = declaration.slice(0, open).trim();
  const nameMatch = before.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
  if (!nameMatch) return { publicState, candidate: null };
  const name = nameMatch[1];
  const prefix = before.slice(0, nameMatch.index).trimEnd();
  if (name === 'operator' || prefix.endsWith('~')) return { publicState, candidate: null };
  const suffix = declaration.slice(close + 1).trim();
  const normalizedSuffix = suffix.startsWith(':') ? '' : suffix;
  const signature = `${declaration.slice(0, close + 1)}${normalizedSuffix ? ` ${normalizedSuffix}` : ''}`;

  return {
    publicState,
    candidate: {
      name,
      constructor: name === className,
      signature: signature.replace(/\s+/g, ' ').trim(),
    },
  };
}

function parseCppInterface(source) {
  const clean = stripCppCommentsAndStrings(source);
  const classMatch = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\b[^;{]*\{/.exec(clean);
  if (!classMatch) return null;
  const className = classMatch[1];
  const open = classMatch.index + classMatch[0].lastIndexOf('{');
  const close = findMatchingBrace(clean, open);
  if (close < 0) return null;

  const body = clean.slice(open + 1, close);
  const methods = [];
  let depth = 0;
  let start = 0;
  let isPublic = false;

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '{') {
      if (depth === 0) {
        const parsed = methodFromSegment(body.slice(start, i), isPublic, className);
        isPublic = parsed.publicState;
        if (parsed.candidate) methods.push(parsed.candidate);
      }
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) start = i + 1;
    } else if (ch === ';' && depth === 0) {
      const parsed = methodFromSegment(body.slice(start, i + 1), isPublic, className);
      isPublic = parsed.publicState;
      if (parsed.candidate) methods.push(parsed.candidate);
      start = i + 1;
    }
  }

  return { className, methods };
}

function indentation(line) {
  return line.match(/^[ \t]*/)?.[0].replace(/\t/g, '    ').length || 0;
}

function cleanPython(source) {
  return source.replace(
    /#[^\r\n]*|'''(?:\\[\s\S]|(?!''')[^\\])*'''|"""(?:\\[\s\S]|(?!""")[^\\])*"""|'(?:\\[\s\S]|[^'\\\r\n])*'|"(?:\\[\s\S]|[^"\\\r\n])*"/g,
    (match) => match.replace(/[^\r\n]/g, ' ')
  );
}

function pythonFunctions(source) {
  const lines = source.split(/\r?\n/);
  const cleanLines = cleanPython(source).split(/\r?\n/);
  const offsets = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  const found = [];
  for (let i = 0; i < cleanLines.length; i += 1) {
    const line = cleanLines[i];
    const match = /^\s*(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(line);
    if (!match) continue;
    const startLine = i;
    let depth = 0;
    let signature = '';
    let complete = false;
    let bodyStart = 0;
    for (let row = i; row < cleanLines.length && !complete; row += 1) {
      const clean = cleanLines[row];
      for (let col = row === i ? match[0].length - 1 : 0; col < clean.length; col += 1) {
        if ('([{'.includes(clean[col])) depth += 1;
        else if (')]}'.includes(clean[col])) depth -= 1;
        else if (clean[col] === ':' && depth === 0) {
          signature += lines[row].slice(0, col + 1).trim();
          complete = true;
          bodyStart = offsets[row] + col + 1;
          i = row;
          break;
        }
      }
      if (!complete) signature += `${lines[row].trim()} `;
    }
    const endOffset = complete ? cleanLines.slice(i + 1).findIndex((next) => (
      next.trim() && indentation(next) <= indentation(line)
    )) : -1;
    if (complete) found.push({
      name: match[1],
      constructor: match[1] === '__init__',
      signature: signature.replace(/\s+/g, ' '),
      indent: indentation(line),
      line: startLine,
      bodyStart,
      bodyEnd: endOffset < 0 ? source.length : offsets[i + 1 + endOffset],
    });
  }
  return found;
}

function parsePythonInterface(source) {
  const lines = cleanPython(source).split(/\r?\n/);
  const classIndex = lines.findIndex((line) => /^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)\b[^:]*:\s*$/.test(line));
  if (classIndex < 0) return null;
  const classMatch = /^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(lines[classIndex]);
  const className = classMatch[1];
  const classIndent = indentation(lines[classIndex]);
  const endOffset = lines.slice(classIndex + 1).findIndex((line) => line.trim() && indentation(line) <= classIndent);
  const end = endOffset < 0 ? lines.length : classIndex + 1 + endOffset;
  const found = pythonFunctions(source).filter((method) => method.line > classIndex && method.line < end);

  if (!found.length) return { className, methods: [] };
  const memberIndent = Math.min(...found.map((item) => item.indent));
  return {
    className,
    methods: found
      .filter((item) => item.indent === memberIndent)
      .map(({ name, constructor, signature }) => ({ name, constructor, signature })),
  };
}

function cppFunctions(source) {
  const clean = stripCppCommentsAndStrings(source).replace(/^[ \t]*#[^\r\n]*/gm, (line) => ' '.repeat(line.length));
  const functions = [];
  let start = 0;
  for (let i = 0; i < clean.length; i += 1) {
    if (clean[i] === '{') {
      const close = findMatchingBrace(clean, i);
      if (close < 0) return [];
      const declaration = clean.slice(start, i).trim();
      if (!/^(?:class|struct|enum|namespace|template|extern)\b/.test(declaration)) {
        const { candidate } = methodFromSegment(declaration, true, '');
        if (candidate && /^[\w:<>,\s*&]+$/.test(declaration.slice(0, declaration.indexOf('(')))) {
          functions.push({ ...candidate, bodyStart: i + 1, bodyEnd: close });
        }
      }
      i = close;
      start = i + 1;
    } else if (clean[i] === ';') {
      start = i + 1;
    }
  }
  return functions;
}

function detectFreeFunctions(source, language) {
  source = (source || '').replace(/\r\n/g, '\n');
  const functions = language === 'python'
    ? pythonFunctions(source || '').filter((item) => item.indent === 0)
    : cppFunctions(source || '');
  const names = [...new Set(functions.map((item) => item.name))];
  if (!names.length) return {
    ok: false,
    mappings: [],
    placeholders: [],
    error: '没有识别到顶层函数定义。C++ 请提供带函数体的普通函数或 main；Python 请使用 def solve / def main 等函数，并保留调用入口。',
  };
  const mappings = names.map((name, index) => ({
    name,
    placeholder: names.length === 1 ? MASKED_FUNCTION : `__TARGET_FUNCTION_${index + 1}__`,
    kind: 'function',
  }));
  const signatures = functions.map((item) => maskTargetInterface(item.signature, mappings));
  let scaffold = source;
  for (const { bodyStart, bodyEnd } of [...functions].reverse()) {
    scaffold = `${scaffold.slice(0, bodyStart)}\n__BODY__\n${scaffold.slice(bodyEnd)}`;
  }
  return {
    ok: true,
    kind: 'free-functions',
    targetName: names[0],
    signature: signatures.join('\n'),
    signatures,
    mappings,
    placeholders: mappings.map((mapping) => mapping.placeholder),
    maskedSource: maskTargetInterface(source, mappings),
    scaffold: maskTargetInterface(scaffold, mappings)
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.trim())
      .join('\n'),
  };
}

function parsedInterface(source, language) {
  if (!source?.trim()) return null;
  return language === 'python' ? parsePythonInterface(source) : parseCppInterface(source);
}

function distinctMethodNames(methods) {
  return [...new Set(methods.filter((method) => !method.constructor).map((method) => method.name))];
}

export function detectTargetInterface(source, language, entryMode = 'class') {
  if (entryMode === 'function') return detectFreeFunctions(source, language);
  const parsed = parsedInterface(source, language);
  if (!parsed) {
    return {
      ok: false,
      mappings: [],
      placeholders: [],
      error: '没有识别到完整的类接口。请保留类声明及其 public 方法模板。',
    };
  }

  const interfaceMethods = language === 'python'
    ? parsed.methods.filter((method) => method.constructor || !method.name.startsWith('_'))
    : parsed.methods;
  const operations = distinctMethodNames(interfaceMethods);
  if (parsed.className === 'Solution') {
    if (operations.length !== 1) {
      return {
        ok: false,
        candidates: interfaceMethods.filter((method) => !method.constructor),
        mappings: [],
        placeholders: [],
        error: operations.length === 0
          ? '没有识别到 class Solution 中的目标函数。请保留一个完整、单行声明的 public 方法。'
          : `识别到 ${operations.length} 个候选函数（${operations.join('、')}）。普通 Solution 模板只能有一个 public 目标方法，helper 请改为 private。`,
      };
    }
    const mappings = [{ name: operations[0], placeholder: MASKED_FUNCTION, kind: 'method' }];
    const signatures = interfaceMethods
      .filter((method) => !method.constructor)
      .map((method) => maskTargetInterface(method.signature, mappings));
    return {
      ok: true,
      kind: 'single-function',
      className: parsed.className,
      targetName: operations[0],
      signature: signatures[0],
      signatures,
      mappings,
      placeholders: mappings.map((mapping) => mapping.placeholder),
      maskedSource: maskTargetInterface(source, mappings),
    };
  }

  if (operations.length === 0) {
    return {
      ok: false,
      candidates: interfaceMethods,
      mappings: [],
      placeholders: [],
      error: '设计类模板必须包含至少一个 public 方法。',
    };
  }

  const mappings = [
    { name: parsed.className, placeholder: MASKED_CLASS, kind: 'class' },
    ...operations.map((name, index) => ({
      name,
      placeholder: `__TARGET_METHOD_${index + 1}__`,
      kind: 'method',
    })),
  ];
  const signatures = interfaceMethods.map((method) => maskTargetInterface(method.signature, mappings));
  return {
    ok: true,
    kind: 'design-class',
    className: parsed.className,
    targetName: parsed.className,
    signature: signatures.join('\n'),
    signatures,
    mappings,
    placeholders: mappings.map((mapping) => mapping.placeholder),
    maskedSource: maskTargetInterface(source, mappings),
  };
}

export function isTargetInterfaceUnchanged(source, language, expected) {
  const current = detectTargetInterface(source, language, expected.kind === 'free-functions' ? 'function' : 'class');
  if (!current.ok || current.kind !== expected.kind) return false;
  if (expected.kind === 'free-functions' && current.scaffold !== expected.scaffold) return false;
  if (current.mappings.length !== expected.mappings.length) return false;
  if (!current.mappings.every((mapping, index) => (
    mapping.name === expected.mappings[index].name
    && mapping.placeholder === expected.mappings[index].placeholder
  ))) return false;
  return JSON.stringify(current.signatures) === JSON.stringify(expected.signatures);
}

// Backward-compatible helpers retained for existing callers and tests.
export function listTargetCandidates(source, language) {
  const parsed = parsedInterface(source, language);
  if (!parsed || parsed.className !== 'Solution') return [];
  return parsed.methods.filter((method) => !method.constructor);
}

export function detectTargetFunction(source, language) {
  return detectTargetInterface(source, language);
}

export function isConfirmedTargetUnchanged(source, language, targetName, confirmedSignature) {
  const current = detectTargetInterface(source, language);
  return current.ok
    && current.kind === 'single-function'
    && current.targetName === targetName
    && current.signature === confirmedSignature;
}

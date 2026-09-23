import { useMemo, useState } from 'react';
import { ProblemRow } from './ui.jsx';

function uniqueProblems(groups) {
  const seen = new Set();
  return groups.flatMap((group) => group.problems || []).filter((problem) => {
    if (seen.has(problem.id)) return false;
    seen.add(problem.id);
    return true;
  });
}

export function ProblemLibraryView({ library, groupIndex, done, toggle, rows }) {
  const [tier, setTier] = useState('all');
  const [diff, setDiff] = useState('all');
  const [hideDone, setHideDone] = useState(false);
  const [query, setQuery] = useState('');

  const groups = useMemo(
    () => groupIndex == null ? library.groups : library.groups.slice(groupIndex, groupIndex + 1),
    [groupIndex, library.groups]
  );
  const displayGroups = useMemo(() => {
    if (groupIndex != null) return groups;
    const seen = new Set();
    return groups.map((group) => ({
      ...group,
      problems: (group.problems || []).filter((problem) => {
        if (seen.has(problem.id)) return false;
        seen.add(problem.id);
        return true;
      }),
    }));
  }, [groupIndex, groups]);
  const all = useMemo(() => uniqueProblems(displayGroups), [displayGroups]);
  const current = groupIndex == null ? null : library.groups[groupIndex];
  const doneCount = all.filter((problem) => done[problem.id]).length;

  const filter = (problems) => problems.filter((problem) => {
    if (tier === 'core' && problem.tier !== 'core') return false;
    if (diff !== 'all' && problem.difficulty !== diff) return false;
    if (hideDone && done[problem.id]) return false;
    if (query) {
      const needle = query.toLowerCase();
      const haystack = `${problem.id} ${problem.title} ${problem.cn || ''} ${(problem.tags || []).join(' ')}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const nextUnsolved = () => {
    const pool = displayGroups.flatMap((group) => filter(group.problems || []));
    const currentIndex = pool.findIndex((problem) => problem.id === rows?.openId);
    const target = pool.slice(currentIndex + 1).find((problem) => !done[problem.id])
      || pool.find((problem) => !done[problem.id]);
    if (!target) return;
    rows?.onOpen(target.id, true);
    requestAnimationFrame(() => document.getElementById(`p-${target.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const hasVisibleUnsolved = displayGroups.some((group) => filter(group.problems || []).some((problem) => !done[problem.id]));

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">{current ? library.name : '当前题库'}</div>
        <h2>{current?.name || library.name}</h2>
        {(current?.description || library.description) && (
          <div className="sub">{current?.description || library.description}</div>
        )}
      </div>

      <div className="stat-row">
        <div className="stat"><div className="v">{all.length}</div><div className="l">题目总数</div></div>
        <div className="stat"><div className="v">{groups.length}</div><div className="l">当前分组</div></div>
        <div className="stat"><div className="v" style={{ color: 'var(--core)' }}>{all.filter((p) => p.tier === 'core').length}</div><div className="l">核心题目</div></div>
        <div className="stat"><div className="v" style={{ color: 'var(--done)' }}>{doneCount}</div><div className="l">已完成</div></div>
      </div>

      <div className="filters">
        <button className={`fbtn${tier === 'all' ? ' on' : ''}`} onClick={() => setTier('all')}>全部</button>
        <button className={`fbtn${tier === 'core' ? ' on' : ''}`} onClick={() => setTier('core')}>核心</button>
        <span style={{ width: 8 }} />
        {['all', 'Easy', 'Medium', 'Hard'].map((value) => (
          <button key={value} className={`fbtn${diff === value ? ' on' : ''}`} onClick={() => setDiff(value)}>
            {value === 'all' ? '难度不限' : value}
          </button>
        ))}
        <span style={{ width: 8 }} />
        <button className={`fbtn${hideDone ? ' on' : ''}`} onClick={() => setHideDone((value) => !value)}>隐藏已完成</button>
        <button className="fbtn go" onClick={nextUnsolved} disabled={!hasVisibleUnsolved}>↓ 下一道未完成</button>
        <span className="fspacer" />
        <input className="fsearch" placeholder="搜索题号 / 标题 / 标签" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      {displayGroups.map((group, displayIndex) => {
        const problems = filter(group.problems || []);
        if (!problems.length) return null;
        const groupDone = (group.problems || []).filter((problem) => done[problem.id]).length;
        return (
          <section key={`${displayIndex}-${group.name}`} className="library-group">
            {groupIndex == null && (
              <div className="card" style={{ marginBottom: 10 }}>
                <div className="card-title">
                  <span className="dot" />
                  {group.name}
                  <span className="badge est" style={{ marginLeft: 'auto' }}>{groupDone}/{group.problems.length}</span>
                </div>
                {group.description && <div style={{ fontSize: 13, color: 'var(--fg-dim)' }}>{group.description}</div>}
              </div>
            )}
            <div className="plist">
              {problems.map((problem) => (
                <ProblemRow
                  key={problem.id}
                  p={problem}
                  done={!!done[problem.id]}
                  onToggle={toggle}
                  open={rows?.openId === problem.id}
                  onOpen={rows?.onOpen || (() => {})}
                  note={rows?.notes?.[problem.id]}
                  onNote={rows?.onNote}
                  onDescribe={rows?.onDescribe}
                  timer={rows?.timers && {
                    elapsed: rows.timers.elapsed[problem.id] || 0,
                    clear: rows.timers.clear,
                  }}
                />
              ))}
            </div>
          </section>
        );
      })}

      {displayGroups.every((group) => filter(group.problems || []).length === 0) && (
        <div className="empty">没有符合筛选条件的题目</div>
      )}
    </>
  );
}

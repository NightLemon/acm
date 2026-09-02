import { useState, useMemo } from 'react';
import { ProblemRow } from './ui.jsx';

const WEEK_META = {
  1: { name: '基础与手感', desc: '双指针、二分、单调栈、堆、滑动窗口。重点是把常用 STL / Python API 和边界处理写熟——核心题里有相当一部分是 Hard，别被「基础」两个字骗了。建议每题都动手实现。' },
  2: { name: '动态规划与图论', desc: '线性 / 区间 / 状压 / 数位 / 树形 DP，最短路、生成树、拓扑排序、并查集，以及二叉树与 Trie。' },
  3: { name: '高级数据结构与算法', desc: '树状数组、线段树（含 lazy 双标记）、KMP / Z 函数 / 字符串哈希、Manacher、数论与组合计数，以及表达式解析类综合题。' },
};

export function AlgoView({ days, week, done, toggle, rows }) {
  const weekDays = useMemo(() => days.filter((d) => d.week === week), [days, week]);
  const [activeDay, setActiveDay] = useState(null);
  const [tier, setTier] = useState('all');
  const [diff, setDiff] = useState('all');
  const [hideDone, setHideDone] = useState(false);
  const [q, setQ] = useState('');

  const shown = activeDay ? weekDays.filter((d) => d.day === activeDay) : weekDays;

  const filter = (ps) =>
    ps.filter((p) => {
      if (tier !== 'all' && p.tier !== tier) return false;
      if (diff !== 'all' && p.difficulty !== diff) return false;
      if (hideDone && done[p.id]) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!(`${p.id} ${p.title} ${p.cn} ${p.tags.join(' ')}`.toLowerCase().includes(s))) return false;
      }
      return true;
    });

  const all = weekDays.flatMap((d) => d.problems);
  const doneCount = all.filter((p) => done[p.id]).length;
  const meta = WEEK_META[week];

  // Open the next unsolved problem in reading order, honouring the current
  // filters — so with 核心 selected it walks the core track only.
  const nextUnsolved = () => {
    const pool = shown.flatMap((d) => filter(d.problems));
    const i = pool.findIndex((p) => p.id === rows?.openId);
    const target = pool.slice(i + 1).find((p) => !done[p.id]) || pool.find((p) => !done[p.id]);
    if (!target) return;
    rows?.onOpen(target.id, true);
    // Let the row render before scrolling to it.
    requestAnimationFrame(() => {
      document.getElementById(`p-${target.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };
  const remaining = all.length - doneCount;

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Week {week} · Day {weekDays[0]?.day}–{weekDays[weekDays.length - 1]?.day}</div>
        <h2>{meta.name}</h2>
        <div className="sub">{meta.desc}</div>
      </div>

      <div className="stat-row">
        <div className="stat"><div className="v">{all.length}</div><div className="l">本周题目</div></div>
        <div className="stat"><div className="v" style={{ color: 'var(--core)' }}>{all.filter((p) => p.tier === 'core').length}</div><div className="l">核心必做</div></div>
        <div className="stat"><div className="v" style={{ color: 'var(--hard)' }}>{all.filter((p) => p.difficulty === 'Hard').length}</div><div className="l">Hard</div></div>
        <div className="stat"><div className="v" style={{ color: 'var(--done)' }}>{doneCount}</div><div className="l">已完成</div></div>
        <div className="stat"><div className="v">{Math.round(all.reduce((a, p) => a + p.est, 0) / 60)}h</div><div className="l">预估总时长</div></div>
      </div>

      <div className="daynav">
        <button className={`daybtn${activeDay === null ? ' on' : ''}`} style={{ width: 'auto', padding: '0 12px' }} onClick={() => setActiveDay(null)}>全部</button>
        {weekDays.map((d) => {
          const complete = d.problems.length > 0 && d.problems.every((p) => done[p.id]);
          return (
            <button key={d.day}
              className={`daybtn${activeDay === d.day ? ' on' : ''}${complete ? ' complete' : ''}`}
              onClick={() => setActiveDay(activeDay === d.day ? null : d.day)}
              title={d.title}>
              {d.day}
            </button>
          );
        })}
      </div>

      <div className="filters">
        <button className={`fbtn${tier === 'all' ? ' on' : ''}`} onClick={() => setTier('all')}>全部</button>
        <button className={`fbtn${tier === 'core' ? ' on' : ''}`} onClick={() => setTier('core')}>核心</button>
        <button className={`fbtn${tier === 'optional' ? ' on' : ''}`} onClick={() => setTier('optional')}>选做</button>
        <span style={{ width: 8 }} />
        <button className={`fbtn${diff === 'all' ? ' on' : ''}`} onClick={() => setDiff('all')}>难度不限</button>
        <button className={`fbtn${diff === 'Medium' ? ' on' : ''}`} onClick={() => setDiff('Medium')}>Medium</button>
        <button className={`fbtn${diff === 'Hard' ? ' on' : ''}`} onClick={() => setDiff('Hard')}>Hard</button>
        <span style={{ width: 8 }} />
        <button className={`fbtn${hideDone ? ' on' : ''}`} onClick={() => setHideDone((h) => !h)}>隐藏已完成</button>
        <button className="fbtn go" onClick={nextUnsolved} disabled={!remaining} title="按当前筛选跳到下一道没做的题">
          ↓ 下一道未完成
        </button>
        <span className="fspacer" />
        <input className="fsearch" placeholder="搜索题号 / 标题 / 标签" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {shown.map((d) => {
        const ps = filter(d.problems);
        if (!ps.length) return null;
        const dDone = d.problems.filter((p) => done[p.id]).length;
        return (
          <div key={d.day} style={{ marginBottom: 30 }}>
            <div className="card" style={{ marginBottom: 10 }}>
              <div className="card-title">
                <span className="dot" />
                Day {d.day} · {d.title}
                <span className="badge est" style={{ marginLeft: 'auto' }}>{dDone}/{d.problems.length}</span>
              </div>
              {d.focus && <div style={{ fontSize: 13, color: 'var(--fg-dim)' }}>{d.focus}</div>}
              {d.drill && (
                <div className="callout warn">
                  <span className="lbl">手感训练</span>
                  {d.drill}
                </div>
              )}
            </div>
            <div className="plist">
              {ps.map((p) => (
                <ProblemRow
                  key={p.id}
                  p={p}
                  done={!!done[p.id]}
                  onToggle={toggle}
                  open={rows?.openId === p.id}
                  onOpen={rows?.onOpen || (() => {})}
                  note={rows?.notes?.[p.id]}
                  onNote={rows?.onNote}
                  timer={rows?.timers && {
                    elapsed: rows.timers.elapsed[p.id] || 0,
                    clear: rows.timers.clear,
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}

      {shown.every((d) => filter(d.problems).length === 0) && (
        <div className="empty">没有符合筛选条件的题目</div>
      )}
    </>
  );
}

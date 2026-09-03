import { lazy, Suspense, useState, useMemo, useEffect, useCallback } from 'react';
import curriculum from '../data/curriculum.json';
import { useProgress } from './useProgress.js';
import { useOfflineSync } from './useOfflineSync.js';
import { useNotes } from './useNotes.js';
import { useTimers } from './useTimers.js';
import { Ring } from './components/ui.jsx';
import { AlgoView } from './components/AlgoView.jsx';
import { MockView } from './components/MockView.jsx';
import { DesignView } from './components/DesignView.jsx';
import { FundamentalsView } from './components/FundamentalsView.jsx';

const CodeChatView = lazy(() => import('./components/CodeChatView.jsx').then((module) => ({
  default: module.CodeChatView,
})));

const NAV = [
  { key: 'w1', label: 'Week 1 · 基础与手感', sub: 'Day 1–7' },
  { key: 'w2', label: 'Week 2 · DP 与图论', sub: 'Day 8–14' },
  { key: 'w3', label: 'Week 3 · 高级数据结构', sub: 'Day 15–21' },
  { key: 'w4', label: 'Week 4 · 综合训练', sub: 'Day 22–28' },
  { key: 'code', label: '描述实现', sub: 'Code + LLM' },
  { key: 'design', label: '系统设计', sub: '框架 + 案例' },
  { key: 'fund', label: '语言细节', sub: '速查附录' },
];

export default function App() {
  const [view, setView] = useState('w1');
  const [codeProblemId, setCodeProblemId] = useState(null);
  const [codePanelOpen, setCodePanelOpen] = useState(false);
  const [codePanelCollapsed, setCodePanelCollapsed] = useState(false);
  // On phones the sidebar is an off-canvas drawer; on desktop it's always visible
  // and this flag is ignored by CSS.
  const [navOpen, setNavOpen] = useState(false);
  const { done, toggle, reset } = useProgress();

  // Lock background scroll while the drawer is open, or the page scrolls under it.
  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [navOpen]);

  const { algoDays, mock, design, fundamentals, handwritten, stats } = curriculum;

  // Overall progress spans every checkable problem in the app, mocks included.
  const allIds = useMemo(() => {
    const s = new Set();
    for (const d of algoDays) for (const p of d.problems) s.add(p.id);
    for (const d of mock?.days || []) for (const p of d.problems || []) s.add(p.id);
    return [...s];
  }, [algoDays, mock]);

  const problemMeta = useMemo(() => {
    if (!codeProblemId) return null;
    const problems = [
      ...algoDays.flatMap((day) => day.problems || []),
      ...(mock?.days || []).flatMap((day) => day.problems || []),
    ];
    const problem = problems.find((item) => item.id === codeProblemId);
    return problem ? {
      id: problem.id,
      title: problem.title,
      cn: problem.cn,
      url: problem.url,
      urlEn: problem.urlEn,
    } : null;
  }, [algoDays, mock, codeProblemId]);

  const doneCount = allIds.filter((id) => done[id]).length;
  const pct = allIds.length ? (doneCount / allIds.length) * 100 : 0;

  const weekPct = (w) => {
    const ps = algoDays.filter((d) => d.week === w).flatMap((d) => d.problems);
    if (!ps.length) return 0;
    return (ps.filter((p) => done[p.id]).length / ps.length) * 100;
  };
  const mockPct = () => {
    const ps = (mock?.days || []).flatMap((d) => d.problems || []);
    if (!ps.length) return 0;
    return (ps.filter((p) => done[p.id]).length / ps.length) * 100;
  };
  const navPct = (key) =>
    key === 'w1' ? weekPct(1) : key === 'w2' ? weekPct(2) : key === 'w3' ? weekPct(3) : key === 'w4' ? mockPct() : null;

  const current = NAV.find((n) => n.key === view);
  const offline = useOfflineSync(allIds);

  // Which problem row is expanded. Lifted out of ProblemRow so it survives
  // filtering and day switching, and so only one problem is open at a time —
  // which is also what makes the think-timer meaningful.
  const [openId, setOpenId] = useState(null);
  const { notes, setNote } = useNotes();
  const timers = useTimers();

  const onOpen = useCallback((id, next) => {
    setOpenId((prev) => {
      if (prev) timers.stop(prev);
      if (next) { timers.start(id); return id; }
      return null;
    });
  }, [timers]);

  // Bundle what every ProblemRow needs so views can forward it as one prop.
  const rowProps = {
    openId,
    onOpen,
    notes,
    onNote: setNote,
    timers,
    onDescribe: (id) => {
      setCodeProblemId(id);
      setCodePanelOpen(true);
      setCodePanelCollapsed(false);
      setNavOpen(false);
    },
  };

  const go = (key) => {
    if (key === 'code') {
      setCodeProblemId(null);
      setCodePanelOpen(true);
      setCodePanelCollapsed(false);
      setNavOpen(false);
      return;
    }
    setView(key);
    setNavOpen(false);
  };
  return (
    <div className={`app${navOpen ? ' nav-open' : ''}${codePanelOpen ? ' code-panel-open' : ''}${codePanelCollapsed ? ' code-panel-collapsed' : ''}`}>
      {/* Mobile-only bar. Hidden at desktop widths via CSS. */}
      <header className="topbar">
        <button className="hamburger" onClick={() => setNavOpen(true)} aria-label="打开目录">
          <span /><span /><span />
        </button>
        <div className="topbar-title">{current?.label || '算法训练'}</div>
        <div className="topbar-pct">{Math.round(pct)}%</div>
      </header>

      <div className="scrim" onClick={() => setNavOpen(false)} />

      <aside className="sidebar">
        <div className="brand">
          <h1>算法训练</h1>
          <p>28-day algorithm curriculum</p>
          <button className="drawer-close" onClick={() => setNavOpen(false)} aria-label="关闭目录">✕</button>
        </div>

        <div className="ring-wrap">
          <Ring pct={pct} size={42} stroke={4} />
          <div className="ring-meta">
            <b>{doneCount}</b> / {allIds.length}<br />题目已完成
          </div>
        </div>

        <nav className="nav">
          <div className="nav-section">
            <div className="nav-label">课程目录</div>
            {NAV.map((n) => {
              const p = navPct(n.key);
              return (
                <button
                  key={n.key}
                  className={`nav-item${n.key === 'code' ? (codePanelOpen ? ' active' : '') : (view === n.key ? ' active' : '')}`}
                  onClick={() => go(n.key)}
                  title={n.label}
                >
                  <span className="n">{n.sub}</span>
                  <span className="t">{n.label}</span>
                  {p !== null && p > 0 && <span className="c">{Math.round(p)}%</span>}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="sidebar-foot">
          <div style={{ marginBottom: 8, fontFamily: 'var(--mono)' }}>
            {stats.totalProblems} 题 · {stats.byDifficulty?.Hard || 0} Hard · {Math.round(stats.totalMinutes / 60)}h
          </div>
          <div className="foot-btns">
            <button
              className="fbtn"
              onClick={offline.start}
              disabled={offline.running}
              title="把全部题面缓存到本机，之后断网也能看"
            >
              {offline.running
                ? `缓存中 ${offline.done}/${offline.total}`
                : offline.finished
                  ? '✓ 已可离线'
                  : '离线缓存题面'}
            </button>
            <button className="fbtn" onClick={reset}>清空进度</button>
          </div>
          {offline.error && <div className="foot-err">{offline.error}</div>}
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          {view === 'w1' && <AlgoView days={algoDays} week={1} done={done} toggle={toggle} rows={rowProps} />}
          {view === 'w2' && <AlgoView days={algoDays} week={2} done={done} toggle={toggle} rows={rowProps} />}
          {view === 'w3' && <AlgoView days={algoDays} week={3} done={done} toggle={toggle} rows={rowProps} />}
          {view === 'w4' && <MockView mock={mock} done={done} toggle={toggle} rows={rowProps} />}
          {view === 'design' && <DesignView design={design} />}
          {view === 'fund' && <FundamentalsView fundamentals={fundamentals} handwritten={handwritten} />}
        </div>
      </main>

      {codePanelOpen && (
        <aside className={`code-drawer${codePanelCollapsed ? ' collapsed' : ''}`} aria-label="代码生成工作区">
          <button
            className="code-drawer-expand"
            type="button"
            onClick={() => setCodePanelCollapsed(false)}
            aria-label="展开代码生成工作区"
            title="展开代码生成工作区"
          >
            <span>‹</span>
            <b>{problemMeta ? `#${problemMeta.id}` : '代码生成'}</b>
          </button>
          <header className="code-drawer-head">
            <button
              className="code-drawer-icon"
              type="button"
              onClick={() => setCodePanelCollapsed(true)}
              aria-label="收起代码生成工作区"
              title="收起"
            >›</button>
            <div className="code-drawer-title">
              <b>{problemMeta ? `#${problemMeta.id} · ${problemMeta.cn || problemMeta.title}` : '独立代码生成'}</b>
              <span>描述逻辑 → 校验 → 生成</span>
            </div>
            {problemMeta?.url && (
              <a className="code-submit-link" href={problemMeta.url} target="_blank" rel="noreferrer">
                打开力扣提交 ↗
              </a>
            )}
            <button
              className="code-drawer-icon close"
              type="button"
              onClick={() => setCodePanelOpen(false)}
              aria-label="关闭代码生成工作区"
              title="关闭"
            >×</button>
          </header>
          <div className="code-drawer-body">
            <Suspense fallback={<div className="empty">正在加载代码编辑器…</div>}>
              <CodeChatView key={problemMeta?.id || 'standalone'} problemMeta={problemMeta} embedded />
            </Suspense>
          </div>
        </aside>
      )}
    </div>
  );
}

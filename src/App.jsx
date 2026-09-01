import { useState, useMemo, useEffect } from 'react';
import curriculum from '../data/curriculum.json';
import { useProgress } from './useProgress.js';
import { useOfflineSync } from './useOfflineSync.js';
import { Ring } from './components/ui.jsx';
import { AlgoView } from './components/AlgoView.jsx';
import { MockView } from './components/MockView.jsx';
import { DesignView } from './components/DesignView.jsx';
import { FundamentalsView } from './components/FundamentalsView.jsx';

const NAV = [
  { key: 'w1', label: 'Week 1 · 基础与手感', sub: 'Day 1–7' },
  { key: 'w2', label: 'Week 2 · DP 与图论', sub: 'Day 8–14' },
  { key: 'w3', label: 'Week 3 · 高级数据结构', sub: 'Day 15–21' },
  { key: 'w4', label: 'Week 4 · 综合训练', sub: 'Day 22–28' },
  { key: 'design', label: '系统设计', sub: '框架 + 案例' },
  { key: 'fund', label: '语言细节', sub: '速查附录' },
];

export default function App() {
  const [view, setView] = useState('w1');
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

  const go = (key) => { setView(key); setNavOpen(false); };
  return (
    <div className={`app${navOpen ? ' nav-open' : ''}`}>
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
                  className={`nav-item${view === n.key ? ' active' : ''}`}
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
          {view === 'w1' && <AlgoView days={algoDays} week={1} done={done} toggle={toggle} />}
          {view === 'w2' && <AlgoView days={algoDays} week={2} done={done} toggle={toggle} />}
          {view === 'w3' && <AlgoView days={algoDays} week={3} done={done} toggle={toggle} />}
          {view === 'w4' && <MockView mock={mock} done={done} toggle={toggle} />}
          {view === 'design' && <DesignView design={design} />}
          {view === 'fund' && <FundamentalsView fundamentals={fundamentals} handwritten={handwritten} />}
        </div>
      </main>
    </div>
  );
}

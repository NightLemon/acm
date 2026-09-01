import { useState } from 'react';
import { useStatement } from '../useStatement.js';

const Check = () => (
  <svg viewBox="0 0 12 12"><polyline points="1.5,6.5 4.5,9.5 10.5,2.5" /></svg>
);

// Everything that would spoil the problem sits behind its own click. Opening a
// problem shows the statement; solving hints stay shut until asked for.
function Spoiler({ label, tone, children }) {
  const [open, setOpen] = useState(false);
  if (!children) return null;
  return (
    <div className={`spoiler${open ? ' open' : ''}${tone ? ' ' + tone : ''}`}>
      <button className="spoiler-t" onClick={() => setOpen((o) => !o)}>
        <span className="arrow">▶</span>
        <span>{label}</span>
        {!open && <span className="spoiler-hint">点击展开</span>}
      </button>
      {open && <div className="spoiler-b">{children}</div>}
    </div>
  );
}

function Statement({ id }) {
  const { loading, data, missing } = useStatement(id, true);

  if (loading) return <div className="stmt-state">题面加载中…</div>;
  if (missing || !data?.content) {
    return (
      <div className="stmt-state">
        本地没有题面数据。运行 <code>npm run statements</code> 抓取，或直接用下方链接查看。
      </div>
    );
  }

  return (
    <>
      <div
        className="statement"
        dangerouslySetInnerHTML={{ __html: data.contentCn || data.content }}
      />
      {data.hints?.length > 0 && (
        <Spoiler label={`官方提示 (${data.hints.length})`}>
          <ol className="hintlist">
            {data.hints.map((h, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: h }} />
            ))}
          </ol>
        </Spoiler>
      )}
    </>
  );
}

export function ProblemRow({ p, done, onToggle }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`prow${done ? ' done' : ''}${open ? ' open' : ''}`}>
      <div className="phead" onClick={() => setOpen((o) => !o)}>
        <button
          className={`chk${done ? ' on' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggle(p.id); }}
          title={done ? '标记为未完成' : '标记为已完成'}
        >
          {done && <Check />}
        </button>
        <span className="pid">{p.id}</span>
        <span className="ptitle">
          <span className="cn">{p.cn || p.title}</span>
          <span className="en">{p.title}</span>
        </span>
        <span className="badges">
          {p.tier === 'core' && <span className="badge core">核心</span>}
          {p.paidOnly && <span className="badge paid">会员</span>}
          <span className={`badge ${p.difficulty}`}>{p.difficulty}</span>
          <span className="badge est">{p.est}m</span>
        </span>
      </div>

      {open && (
        <div className="pbody">
          <Statement id={p.id} />

          <div className="spoilers">
            {p.idea && <Spoiler label="解题思路">{p.idea}</Spoiler>}
            {p.pitfall && <Spoiler label="⚠ 易错点" tone="pit">{p.pitfall}</Spoiler>}
            {p.variants?.length > 0 && (
              <Spoiler label="延伸 / 变体">
                <div className="vlist">
                  {p.variants.map((v, i) => <span className="vtag" key={i}>{v}</span>)}
                </div>
              </Spoiler>
            )}
          </div>

          {p.tags?.length > 0 && (
            <div className="tags">
              {p.tags.map((t) => <span className="tag" key={t}>{t}</span>)}
            </div>
          )}
          <div className="plinks">
            <a className="plink" href={p.url} target="_blank" rel="noreferrer">力扣 · 提交 / 题解 ↗</a>
            <a className="plink" href={p.urlEn} target="_blank" rel="noreferrer">LeetCode ↗</a>
          </div>
        </div>
      )}
    </div>
  );
}

export function Ring({ pct, size = 42, stroke = 4 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--done)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset .35s ease' }}
        />
      </svg>
      <div className="val">{Math.round(pct)}%</div>
    </div>
  );
}

export function Collapsible({ label, children, defaultOpen = false, meta }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="qa">
      <div className={`qa-q${open ? ' open' : ''}`} onClick={() => setOpen((o) => !o)}>
        <span className="arrow">▶</span>
        <span className="topic">{label}</span>
        {meta && <span className="badge est">{meta}</span>}
      </div>
      {open && <div className="qa-a">{children}</div>}
    </div>
  );
}

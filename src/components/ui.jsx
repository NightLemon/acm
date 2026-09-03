import { useState, useEffect } from 'react';
import { useStatement } from '../useStatement.js';
import { fmtTime } from '../useTimers.js';

const Check = () => (
  <svg viewBox="0 0 12 12"><polyline points="1.5,6.5 4.5,9.5 10.5,2.5" /></svg>
);

// Everything that would spoil the problem sits behind its own click. Opening a
// problem shows the statement; solving hints stay shut until asked for.
// `gate` (optional) adds a second, deliberate confirmation for hints you asked
// the app to hold back until you've actually spent time on the problem.
function Spoiler({ label, tone, gate, children }) {
  const [open, setOpen] = useState(false);
  const [override, setOverride] = useState(false);
  if (!children) return null;

  const locked = gate && !override;

  return (
    <div className={`spoiler${open ? ' open' : ''}${tone ? ' ' + tone : ''}`}>
      <button className="spoiler-t" onClick={() => setOpen((o) => !o)}>
        <span className="arrow">▶</span>
        <span>{label}</span>
        {!open && <span className="spoiler-hint">{locked ? gate.hint : '点击展开'}</span>}
      </button>
      {open && (
        locked ? (
          <div className="spoiler-b gate">
            <div className="gate-msg">{gate.msg}</div>
            <button className="gate-btn" onClick={() => setOverride(true)}>还是现在就看</button>
          </div>
        ) : (
          <div className="spoiler-b">{children}</div>
        )
      )}
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

// How long you're expected to sit with a problem before the idea unlocks.
// Scaled off the estimate but clamped — 12 minutes on a warm-up isn't useful,
// and 35 on a Hard is longer than anyone wants to be stuck without a nudge.
const gateSeconds = (p) => Math.min(15, Math.max(5, Math.round((p.est || 20) * 0.6))) * 60;

export function ProblemRow({ p, done, onToggle, open, onOpen, timer, note, onNote, onDescribe }) {
  const [draft, setDraft] = useState(note || '');
  const spent = timer?.elapsed || 0;
  const need = gateSeconds(p);

  // Keep the textarea in sync when the note changes underneath us (reset, or
  // the same problem rendered in two places).
  useEffect(() => { setDraft(note || ''); }, [note, p.id]);

  const gate = timer && spent < need
    ? {
        hint: `再想 ${fmtTime(need - spent)}`,
        msg: `建议先自己想满 ${Math.round(need / 60)} 分钟——已计时 ${fmtTime(spent)}。卡住不是坏事，写不出来的那一步才是这题真正要练的地方。`,
      }
    : null;

  return (
    <div id={`p-${p.id}`} className={`prow${done ? ' done' : ''}${open ? ' open' : ''}`}>
      <div className="phead" onClick={() => onOpen(p.id, !open)}>
        <button
          className={`chk${done ? ' on' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggle(p.id); }}
          title={done ? '标记为未完成' : '标记为已完成'}
        >
          {done && <Check />}
        </button>
        <a
          className="pid"
          href={p.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="在力扣打开"
        >
          {p.id}
        </a>
        <span className="ptitle">
          <span className="cn">{p.cn || p.title}</span>
          <span className="en">{p.title}</span>
        </span>
        <span className="badges">
          {spent > 0 && (
            <span className={`badge time${open ? ' live' : ''}`} title="累计思考时间">
              {fmtTime(spent)}
            </span>
          )}
          {note && <span className="badge note" title={note}>笔记</span>}
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
            {p.idea && <Spoiler label="解题思路" gate={gate}>{p.idea}</Spoiler>}
            {p.pitfall && <Spoiler label="⚠ 易错点" tone="pit">{p.pitfall}</Spoiler>}
            {p.variants?.length > 0 && (
              <Spoiler label="延伸 / 变体">
                <div className="vlist">
                  {p.variants.map((v, i) => <span className="vtag" key={i}>{v}</span>)}
                </div>
              </Spoiler>
            )}
          </div>

          {onNote && (
            <div className="pnote">
              <textarea
                className="pnote-in"
                placeholder="写下这题的一句话收获——状态怎么定义、哪个边界卡了你。二刷时先看这里。"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => onNote(p.id, draft)}
                rows={2}
              />
            </div>
          )}

          {p.tags?.length > 0 && (
            <div className="tags">
              {p.tags.map((t) => <span className="tag" key={t}>{t}</span>)}
            </div>
          )}
          <div className="plinks">
            {onDescribe && (
              <button className="plink describe" onClick={() => onDescribe(p.id)}>描述逻辑并生成代码 →</button>
            )}
            <a className="plink" href={p.url} target="_blank" rel="noreferrer">力扣 · 提交 / 题解 ↗</a>
            <a className="plink" href={p.urlEn} target="_blank" rel="noreferrer">LeetCode ↗</a>
            {spent > 0 && (
              <button className="plink ghost" onClick={() => timer.clear(p.id)}>重置计时</button>
            )}
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

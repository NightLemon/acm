import { useState } from 'react';
import { ProblemRow, Collapsible } from './ui.jsx';

const STRAT_LABELS = {
  pacing: '时间分配',
  whenToSkip: '何时弃题',
  partialCredit: '拿部分分',
  debugging: '卡住了怎么查',
};

export function MockView({ mock, done, toggle }) {
  const days = mock?.days || [];
  const [active, setActive] = useState(null);

  if (!days.length) return <div className="empty">暂无训练内容</div>;

  const shown = active ? days.filter((d) => d.day === active) : days;
  const all = days.flatMap((d) => d.problems || []);
  const doneCount = all.filter((p) => done[p.id]).length;

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Week 4 · Day {days[0]?.day}–{days[days.length - 1]?.day}</div>
        <h2>综合训练</h2>
        <div className="sub">
          按套计时练习，不再引入新知识点。每套四题难度递进，配有时间分配、取舍判断与复盘要点。
        </div>
      </div>

      <div className="stat-row">
        <div className="stat"><div className="v">{days.length}</div><div className="l">模拟场次</div></div>
        <div className="stat"><div className="v">{all.length}</div><div className="l">题目总数</div></div>
        <div className="stat"><div className="v" style={{ color: 'var(--done)' }}>{doneCount}</div><div className="l">已完成</div></div>
      </div>

      <div className="daynav">
        <button className={`daybtn${active === null ? ' on' : ''}`} style={{ width: 'auto', padding: '0 12px' }} onClick={() => setActive(null)}>全部</button>
        {days.map((d) => {
          const ps = d.problems || [];
          const complete = ps.length > 0 && ps.every((p) => done[p.id]);
          return (
            <button key={d.day}
              className={`daybtn${active === d.day ? ' on' : ''}${complete ? ' complete' : ''}`}
              onClick={() => setActive(active === d.day ? null : d.day)}
              title={d.title}>
              {d.day}
            </button>
          );
        })}
      </div>

      {shown.map((d) => (
        <div key={d.day} className="mockday">
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-title">
              <span className="dot" />
              Day {d.day} · {d.title}
              {d.duration && <span className="badge est" style={{ marginLeft: 'auto' }}>{d.duration} 分钟</span>}
            </div>
            {d.style && <div style={{ fontSize: 13, color: 'var(--fg-dim)' }}>{d.style}</div>}

            {d.strategy && (
              <div className="stratgrid">
                {Object.entries(STRAT_LABELS).map(([k, label]) =>
                  d.strategy[k] ? (
                    <div className="strat" key={k}>
                      <div className="k">{label}</div>
                      <div className="v">{d.strategy[k]}</div>
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>

          <div className="plist">
            {(d.problems || []).map((p) => (
              <ProblemRow key={p.id} p={p} done={!!done[p.id]} onToggle={toggle} />
            ))}
          </div>

          {d.review && (
            <div style={{ marginTop: 10 }}>
              <Collapsible label="复盘要点">
                <div style={{ whiteSpace: 'pre-wrap' }}>{d.review}</div>
              </Collapsible>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

import { Collapsible } from './ui.jsx';

const SECTIONS = [
  { key: 'cpp', label: 'C++' },
  { key: 'python', label: 'Python' },
  { key: 'common', label: '通用' },
];

export function FundamentalsView({ fundamentals, handwritten }) {
  const f = fundamentals || {};
  const hw = handwritten || [];

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">附录</div>
        <h2>语言细节速查</h2>
        <div className="sub">
          只收录实际写题时容易踩的语言陷阱与复杂度对照，以及少数几个值得亲手实现一遍的经典结构。
        </div>
      </div>

      {SECTIONS.map(({ key, label }) => {
        const items = f[key] || [];
        if (!items.length) return null;
        return (
          <div key={key} style={{ marginBottom: 26 }}>
            <div className="section-title">{label}</div>
            {items.map((it, i) => (
              <Collapsible key={i} label={it.topic}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{it.note}</div>
              </Collapsible>
            ))}
          </div>
        );
      })}

      {hw.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <div className="section-title">经典结构实现</div>
          {hw.map((h, i) => (
            <Collapsible key={i} label={h.name} meta={h.lcId ? `LC ${h.lcId}` : undefined}>
              {h.why && <p style={{ marginTop: 0 }}>{h.why}</p>}
              {h.keyPoints?.length > 0 && (
                <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
                  {h.keyPoints.map((k, j) => <li key={j} style={{ marginBottom: 4 }}>{k}</li>)}
                </ul>
              )}
              {h.url && (
                <div className="plinks">
                  <a className="plink" href={h.url} target="_blank" rel="noreferrer">
                    力扣 {h.lcTitle || h.lcId} ↗
                  </a>
                </div>
              )}
            </Collapsible>
          ))}
        </div>
      )}
    </>
  );
}

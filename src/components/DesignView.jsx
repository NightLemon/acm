import { Collapsible } from './ui.jsx';

// The design fragment is authored separately and its exact shape can drift, so
// every section here degrades to nothing rather than throwing on a missing key.
function Bullets({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="dlist">
      {items.map((it, i) => (
        <li key={i}>{typeof it === 'string' ? it : it.text || JSON.stringify(it)}</li>
      ))}
    </ul>
  );
}

function Block({ label, value }) {
  if (!value) return null;
  return (
    <div className="pfield">
      <div className="k">{label}</div>
      {Array.isArray(value) ? <Bullets items={value} /> : <div className="v">{value}</div>}
    </div>
  );
}

export function DesignView({ design }) {
  const frameworks = design?.frameworks || [];
  const components = design?.components || [];
  const cases = design?.cases || design?.designs || [];

  const empty = !frameworks.length && !components.length && !cases.length;

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">附录</div>
        <h2>系统设计</h2>
        <div className="sub">
          每个案例按「需求 → 容量估算 → 高层设计 → 数据模型 → 权衡 → 瓶颈」组织，
          重点在方案取舍的推导过程，而非架构图本身。
        </div>
      </div>

      {empty && <div className="empty">系统设计内容尚未生成。运行 <code>npm run rebuild</code> 后刷新。</div>}

      {frameworks.length > 0 && (
        <>
          <div className="section-title">答题框架</div>
          {frameworks.map((f, i) => (
            <Collapsible key={i} label={f.name || f.title || `框架 ${i + 1}`} meta={f.meta} defaultOpen={i === 0}>
              <Block label="要点" value={f.summary || f.note} />
              <Block label="步骤" value={f.steps} />
              <Block label="常见追问" value={f.followups} />
            </Collapsible>
          ))}
        </>
      )}

      {components.length > 0 && (
        <>
          <div className="section-title">核心组件</div>
          {components.map((c, i) => (
            <Collapsible key={i} label={c.name || c.title || `组件 ${i + 1}`} meta={c.meta}>
              <Block label="是什么" value={c.summary || c.what || c.note} />
              <Block label="什么时候用" value={c.whenToUse} />
              <Block label="权衡" value={c.tradeoffs} />
              <Block label="坑点" value={c.pitfalls} />
            </Collapsible>
          ))}
        </>
      )}

      {cases.length > 0 && (
        <>
          <div className="section-title">案例</div>
          {cases.map((d, i) => (
            <Collapsible key={i} label={d.name || d.title || `案例 ${i + 1}`} meta={d.meta || d.company}>
              <Block label="题目 / 场景" value={d.problem || d.scenario || d.summary} />
              <Block label="需求与约束" value={d.requirements || d.constraints} />
              <Block label="容量估算" value={d.estimation || d.capacity} />
              <Block label="高层设计" value={d.highLevel || d.design} />
              <Block label="数据模型" value={d.dataModel} />
              <Block label="关键权衡" value={d.tradeoffs} />
              <Block label="瓶颈与扩展" value={d.bottlenecks || d.scaling} />
              <Block label="常见追问" value={d.followups} />
            </Collapsible>
          ))}
        </>
      )}
    </div>
  );
}

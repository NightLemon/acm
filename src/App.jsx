import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import curriculum from '../data/curriculum.json';
import { createBuiltinLibrary, uniqueProblemIds } from './libraryData.js';
import { migrateLegacyState } from './libraryState.js';
import { useLibraries } from './useLibraries.js';
import { useProgress } from './useProgress.js';
import { useOfflineSync } from './useOfflineSync.js';
import { useNotes } from './useNotes.js';
import { useTimers } from './useTimers.js';
import { clearCodeSessions } from './useCodeSessions.js';
import { Ring } from './components/ui.jsx';
import { ProblemLibraryView } from './components/ProblemLibraryView.jsx';

const CodeChatView = lazy(() => import('./components/CodeChatView.jsx').then((module) => ({
  default: module.CodeChatView,
})));

const BUILTIN_LIBRARY = createBuiltinLibrary(curriculum);

function LibraryManager({ libraries, open, onClose }) {
  const fileRef = useRef(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setMessage('');
    try {
      const library = await libraries.importFile(file);
      if (library) {
        setMessage(`已导入并切换到“${library.name}”`);
        setMessageType('success');
      }
    } catch (error) {
      setMessage(error?.message || '题库导入失败');
      setMessageType('error');
    } finally {
      setImporting(false);
    }
  };

  const remove = (library) => {
    if (library.builtin) return;
    if (!window.confirm(`删除题库“${library.name}”及其完成状态、笔记和计时？此操作不可撤销。`)) return;
    try {
      libraries.deleteLibrary(library.id);
      setMessage(`已删除“${library.name}”`);
      setMessageType('success');
    } catch {
      setMessage('删除失败，浏览器存储可能不可用');
      setMessageType('error');
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="library-modal" role="dialog" aria-modal="true" aria-label="管理题库" onMouseDown={(event) => event.stopPropagation()}>
        <header className="library-modal-head">
          <div><h2>管理题库</h2><p>题库只保存在当前浏览器中。</p></div>
          <button className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        </header>

        <div className="library-list">
          {libraries.summaries.map((library) => (
            <div className={`library-list-item${library.id === libraries.activeId ? ' active' : ''}`} key={library.id}>
              <button className="library-list-main" onClick={() => libraries.activate(library.id)}>
                <b>{library.name}</b><span>{library.builtin ? '内置题库' : library.id}</span>
              </button>
              {library.id === libraries.activeId && <span className="library-current">当前</span>}
              {!library.builtin && <button className="library-delete" onClick={() => remove(library)}>删除</button>}
            </div>
          ))}
        </div>

        <div className="library-import-actions">
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile} />
          <button className="primary-btn" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? '正在校验…' : '导入 JSON 题库'}
          </button>
          <a className="secondary-btn" href={`${import.meta.env.BASE_URL}problem-library-template.json`} download>下载完整示例</a>
        </div>
        <p className="library-template-help">
          示例文件可直接导入。每道题填写 source 和 leetcode.com 原题 url，id 可由链接识别；标题、难度和标签会自动补齐。
        </p>
        {message && <div className={`library-message ${messageType}`}>{message}</div>}
        {libraries.error && <div className="library-message error">{libraries.error}</div>}
      </section>
    </div>
  );
}

function LibraryWorkspace({ library, libraries, onManage }) {
  const libraryId = library.id;
  const [groupIndex, setGroupIndex] = useState(null);
  const [codeProblemId, setCodeProblemId] = useState(null);
  const [codePanelOpen, setCodePanelOpen] = useState(false);
  const [codePanelCollapsed, setCodePanelCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [externalProblem, setExternalProblem] = useState(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');

  const { done, toggle, clear: clearProgress } = useProgress(libraryId);
  const { notes, setNote, clear: clearNotes } = useNotes(libraryId);
  const timers = useTimers(libraryId);
  const allIds = useMemo(() => uniqueProblemIds(library), [library]);
  const offline = useOfflineSync(allIds);

  const allProblems = useMemo(() => library.groups.flatMap((group) => group.problems || []), [library]);
  const problemMeta = useMemo(() => {
    if (!codeProblemId) return externalProblem;
    const problem = allProblems.find((item) => item.id === codeProblemId);
    return problem ? {
      source: problem.source,
      id: problem.id,
      title: problem.title,
      cn: problem.cn,
      slug: problem.slug,
      url: problem.url,
      urlEn: problem.urlEn,
    } : null;
  }, [allProblems, codeProblemId, externalProblem]);

  const loadProblemLink = async (event) => {
    event.preventDefault();
    if (!linkDraft.trim() || linkLoading) return;
    setLinkLoading(true);
    setLinkError('');
    try {
      const problem = await libraries.resolveUrl(linkDraft.trim());
      setExternalProblem(problem);
      setCodeProblemId(null);
      setCodePanelOpen(true);
      setCodePanelCollapsed(false);
      setLinkDraft(problem.url);
    } catch (loadError) {
      setLinkError(loadError?.message || '无法识别这个 LeetCode 链接');
    } finally {
      setLinkLoading(false);
    }
  };

  const doneCount = allIds.filter((id) => done[id]).length;
  const pct = allIds.length ? (doneCount / allIds.length) * 100 : 0;
  const currentLabel = groupIndex == null ? library.name : library.groups[groupIndex]?.name;

  const onOpen = useCallback((id, next) => {
    setOpenId((previous) => {
      if (previous) timers.stop(previous);
      if (next) {
        timers.start(id);
        return id;
      }
      return null;
    });
  }, [timers]);

  const changeLibrary = (nextId) => {
    if (openId) timers.stop(openId);
    setOpenId(null);
    setCodeProblemId(null);
    setExternalProblem(null);
    setCodePanelOpen(false);
    libraries.activate(nextId);
    setNavOpen(false);
  };

  const selectGroup = (nextGroup) => {
    if (openId) timers.stop(openId);
    setOpenId(null);
    setGroupIndex(nextGroup);
    setNavOpen(false);
  };

  const resetCurrent = () => {
    if (!window.confirm(`清空题库“${library.name}”的完成状态、笔记、计时和当前代码会话？此操作不可撤销。`)) return;
    if (openId) timers.stop(openId);
    clearProgress();
    clearNotes();
    timers.clearAll();
    clearCodeSessions(libraryId);
    setOpenId(null);
    setCodeProblemId(null);
    setExternalProblem(null);
    setCodePanelOpen(false);
  };

  const groupPct = (group) => {
    const ids = [...new Set((group.problems || []).map((problem) => problem.id))];
    if (!ids.length) return 0;
    return ids.filter((id) => done[id]).length / ids.length * 100;
  };

  const rowProps = {
    openId,
    onOpen,
    notes,
    onNote: setNote,
    timers,
    onDescribe: (id) => {
      setCodeProblemId(id);
      setExternalProblem(null);
      setCodePanelOpen(true);
      setCodePanelCollapsed(false);
      setNavOpen(false);
    },
  };

  return (
    <div className={`app${navOpen ? ' nav-open' : ''}${codePanelOpen ? ' code-panel-open' : ''}${codePanelCollapsed ? ' code-panel-collapsed' : ''}`}>
      <header className="topbar">
        <button className="hamburger" onClick={() => setNavOpen(true)} aria-label="打开目录"><span /><span /><span /></button>
        <div className="topbar-title">{currentLabel}</div><div className="topbar-pct">{Math.round(pct)}%</div>
      </header>
      <div className="scrim" onClick={() => setNavOpen(false)} />

      <aside className="sidebar">
        <div className="brand">
          <h1>个人刷题库</h1><p>LeetCode problem libraries</p>
          <button className="drawer-close" onClick={() => setNavOpen(false)} aria-label="关闭目录">✕</button>
        </div>

        <div className="library-switcher">
          <label htmlFor="library-select">当前题库</label>
          <select id="library-select" value={libraries.activeId} onChange={(event) => changeLibrary(event.target.value)}>
            {libraries.summaries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button className="manage-library-btn" onClick={onManage}>管理 / 导入题库</button>
        </div>

        <div className="ring-wrap">
          <Ring pct={pct} size={42} stroke={4} />
          <div className="ring-meta"><b>{doneCount}</b> / {allIds.length}<br />题目已完成</div>
        </div>

        <nav className="nav">
          <div className="nav-section">
            <div className="nav-label">题目分组</div>
            <button className={`nav-item${groupIndex == null ? ' active' : ''}`} onClick={() => selectGroup(null)}>
              <span className="n">ALL</span><span className="t">全部题目</span>{pct > 0 && <span className="c">{Math.round(pct)}%</span>}
            </button>
            {library.groups.map((group, index) => {
              const progress = groupPct(group);
              return (
                <button key={`${group.name}-${index}`} className={`nav-item${groupIndex === index ? ' active' : ''}`} onClick={() => selectGroup(index)} title={group.name}>
                  <span className="n">{index + 1}</span><span className="t">{group.name}</span>{progress > 0 && <span className="c">{Math.round(progress)}%</span>}
                </button>
              );
            })}
          </div>
          <div className="nav-section">
            <div className="nav-label">工具</div>
            <button className={`nav-item${codePanelOpen && !codeProblemId ? ' active' : ''}`} onClick={() => {
              setCodeProblemId(null);
              setExternalProblem(null);
              setLinkDraft('');
              setLinkError('');
              setCodePanelOpen(true);
              setCodePanelCollapsed(false);
              setNavOpen(false);
            }}>
              <span className="n">&lt;/&gt;</span><span className="t">独立代码生成</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-foot">
          <div className="library-summary">{allIds.length} 道题 · {library.groups.length} 个分组</div>
          <div className="foot-btns">
            <button className="fbtn" onClick={offline.start} disabled={offline.running} title="缓存当前部署中已有的题面">
              {offline.running ? `缓存中 ${offline.done}/${offline.total}` : offline.finished
                ? offline.missing > 0 ? `已缓存 ${offline.available} · 缺失 ${offline.missing}` : '✓ 已可离线'
                : '离线缓存题面'}
            </button>
            <button className="fbtn" onClick={resetCurrent}>清空当前题库状态</button>
          </div>
          {offline.error && <div className="foot-err">{offline.error}</div>}
          {libraries.error && <div className="foot-err">{libraries.error}</div>}
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          <ProblemLibraryView key={`${libraryId}:${groupIndex ?? 'all'}`} library={library} groupIndex={groupIndex} done={done} toggle={toggle} rows={rowProps} />
        </div>
      </main>

      {codePanelOpen && (
        <aside className={`code-drawer${codePanelCollapsed ? ' collapsed' : ''}`} aria-label="代码生成工作区">
          <button className="code-drawer-expand" type="button" onClick={() => setCodePanelCollapsed(false)} aria-label="展开代码生成工作区" title="展开代码生成工作区">
            <span>‹</span><b>{problemMeta ? `#${problemMeta.id}` : '代码生成'}</b>
          </button>
          <header className="code-drawer-head">
            <button className="code-drawer-icon" type="button" onClick={() => setCodePanelCollapsed(true)} aria-label="收起代码生成工作区" title="收起">›</button>
            <div className="code-drawer-title"><b>{problemMeta ? `#${problemMeta.id} · ${problemMeta.cn || problemMeta.title}` : '独立代码生成'}</b><span>描述逻辑 → 校验 → 生成</span></div>
            {problemMeta?.url && <a className="code-submit-link" href={problemMeta.url} target="_blank" rel="noreferrer">打开力扣提交 ↗</a>}
            <button className="code-drawer-icon close" type="button" onClick={() => setCodePanelOpen(false)} aria-label="关闭代码生成工作区" title="关闭">×</button>
          </header>
          <div className="code-drawer-body">
            {!codeProblemId && (
              <form className="leetcode-link-loader" onSubmit={loadProblemLink}>
                <label htmlFor="leetcode-problem-url">LeetCode 题目链接</label>
                <div>
                  <input
                    id="leetcode-problem-url"
                    type="url"
                    value={linkDraft}
                    onChange={(event) => setLinkDraft(event.target.value)}
                    placeholder="https://leetcode.com/problems/two-sum/"
                    autoComplete="off"
                  />
                  <button className="primary-btn" type="submit" disabled={!linkDraft.trim() || linkLoading}>
                    {linkLoading ? '正在识别…' : '加载作答模板'}
                  </button>
                </div>
                {linkError && <div className="code-error" role="alert">{linkError}</div>}
              </form>
            )}
            <Suspense fallback={<div className="empty">正在加载代码编辑器…</div>}>
              <CodeChatView key={problemMeta?.id || 'standalone'} problemMeta={problemMeta} embedded libraryId={libraryId} />
            </Suspense>
          </div>
        </aside>
      )}
    </div>
  );
}

export default function App() {
  useState(() => migrateLegacyState());
  const libraries = useLibraries(BUILTIN_LIBRARY);
  const [managerOpen, setManagerOpen] = useState(false);

  if (!libraries.activeLibrary) return <div className="app-loading">正在加载题库…</div>;

  return (
    <>
      <LibraryWorkspace key={libraries.activeLibrary.id} library={libraries.activeLibrary} libraries={libraries} onManage={() => setManagerOpen(true)} />
      <LibraryManager libraries={libraries} open={managerOpen} onClose={() => setManagerOpen(false)} />
    </>
  );
}

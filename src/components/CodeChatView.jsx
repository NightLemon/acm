import { useEffect, useMemo, useRef, useState } from 'react';
import codeTemplates from '../../data/code-templates.json';
import { CodeEditor } from './CodeEditor.jsx';
import { emptyCodeSession, useCodeSession } from '../useCodeSessions.js';
import {
  detectTargetFunction,
  isConfirmedTargetUnchanged,
  replaceIdentifier,
  restoreIdentifier,
} from '../llm/codeAnonymizer.js';
import {
  buildGenerationMessages,
  buildValidationMessages,
  parseGeneratedResponse,
  parseValidationResponse,
} from '../llm/prompts.js';
import {
  completeChat,
  listModels,
  streamChat,
  validateProviderConfig,
} from '../llm/openAiCompatibleClient.js';
import {
  clearStoredApiKey,
  loadProviderSettings,
  saveProviderSettings,
} from '../llm/providerStorage.js';

const HEIGHTS = { compact: 260, standard: 360, tall: 520 };

function messageId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function assistantMessage(content, kind) {
  return { id: messageId(), role: 'assistant', kind, content, createdAt: Date.now() };
}

function UserMessage({ message }) {
  return (
    <div className="code-message user">
      <div className="code-message-meta">你的描述</div>
      <div className="code-message-text">{message.content}</div>
    </div>
  );
}

function AssistantMessage({ message }) {
  const generated = message.kind === 'generated';
  return (
    <div className={`code-message assistant${generated ? ' generated' : ''}`}>
      <div className="code-message-meta">{generated ? '已生成并写入编辑器' : '需要补充'}</div>
      <div className="code-message-text">{message.content}</div>
    </div>
  );
}

export function CodeChatView({ problemMeta, embedded = false }) {
  const { session, updateSession, clearSession, ready, storageError } = useCodeSession(problemMeta?.id);
  const [draft, setDraft] = useState('');
  const [heightKey, setHeightKey] = useState(embedded ? 'compact' : 'standard');
  const [provider, setProvider] = useState(loadProviderSettings);
  const [providerOpen, setProviderOpen] = useState(() => !loadProviderSettings().apiKey);
  const [providerError, setProviderError] = useState('');
  const [detectedModels, setDetectedModels] = useState([]);
  const [modelProbe, setModelProbe] = useState({ status: 'idle', error: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(null);
  const modelProbeRef = useRef(null);
  const endRef = useRef(null);
  const templateAttemptsRef = useRef(new Set());
  const problemTemplates = problemMeta ? codeTemplates[String(problemMeta.id)] : null;
  const currentTemplate = problemTemplates?.[session.language] || '';

  const detection = useMemo(
    () => detectTargetFunction(session.source, session.language),
    [session.source, session.language]
  );

  useEffect(() => {
    try {
      saveProviderSettings(provider);
      setProviderError('');
    } catch {
      setProviderError('Provider 配置无法写入浏览器存储。');
    }
  }, [provider]);

  const probeModels = async (baseUrl, apiKey, signal) => {
    setModelProbe({ status: 'loading', error: '' });
    try {
      const models = await listModels({ baseUrl, apiKey }, { signal });
      setDetectedModels(models);
      setModelProbe({ status: 'success', error: '' });
      setProvider((current) => models.includes(current.model)
        ? current
        : { ...current, model: models[0] });
    } catch (probeError) {
      if (probeError?.name === 'AbortError') return;
      setDetectedModels([]);
      setModelProbe({
        status: 'error',
        error: probeError?.message || '模型探测失败，仍可手动填写模型名称。',
      });
    }
  };

  useEffect(() => {
    modelProbeRef.current?.abort();
    if (!provider.baseUrl.trim() || !provider.apiKey.trim()) {
      setDetectedModels([]);
      setModelProbe({ status: 'idle', error: '' });
      return undefined;
    }
    const controller = new AbortController();
    modelProbeRef.current = controller;
    const timer = setTimeout(() => {
      probeModels(provider.baseUrl, provider.apiKey, controller.signal);
    }, 700);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [provider.baseUrl, provider.apiKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: busy ? 'auto' : 'smooth', block: 'nearest' });
  }, [session.messages, busy]);

  useEffect(() => () => {
    abortRef.current?.abort();
    modelProbeRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!ready || !problemMeta || !currentTemplate) return;
    const attemptKey = `${problemMeta.id}:${session.language}`;
    if (templateAttemptsRef.current.has(attemptKey)) return;
    templateAttemptsRef.current.add(attemptKey);
    if (session.source.trim()) return;
    updateSession((current) => ({
      ...current,
      source: currentTemplate,
      sources: { ...current.sources, [current.language]: currentTemplate },
      targetName: '',
      confirmedSignature: '',
    }));
  }, [ready, problemMeta, currentTemplate, session.language, session.source, updateSession]);

  const changeSource = (source) => {
    setCopied(false);
    updateSession({
      ...session,
      source,
      sources: { ...session.sources, [session.language]: source },
      targetName: '',
      confirmedSignature: '',
    });
  };

  const changeLanguage = (language) => {
    const sources = { ...session.sources, [session.language]: session.source };
    const source = sources[language] || problemTemplates?.[language] || '';
    updateSession({
      ...session,
      language,
      source,
      sources: { ...sources, [language]: source },
      targetName: '',
      confirmedSignature: '',
    });
    setError('');
  };

  const addAssistant = (content, kind = 'clarification') => {
    updateSession((current) => ({
      ...current,
      messages: [...current.messages, assistantMessage(content, kind)],
    }));
  };

  const submit = async (event) => {
    event?.preventDefault();
    if (busy) return;
    const content = draft.trim();
    if (!content) { setError('请先描述要实现的逻辑。'); return; }
    if (!detection.ok) { setError(detection.error); return; }
    try { validateProviderConfig(provider); }
    catch (configError) { setProviderOpen(true); setError(configError.message); return; }

    const userMessage = {
      id: messageId(),
      role: 'user',
      kind: 'description',
      content,
      createdAt: Date.now(),
    };
    const conversation = [...session.messages, userMessage];
    const targetName = detection.targetName;
    const confirmedSignature = detection.signature;
    const maskedSource = replaceIdentifier(session.source, targetName);
    const requestData = {
      language: session.language,
      maskedSource,
      conversation,
      targetName,
    };
    const controller = new AbortController();
    abortRef.current = controller;
    updateSession({ ...session, messages: conversation });
    setDraft('');
    setError('');
    setBusy('validating');

    try {
      const validationText = await completeChat(
        provider,
        buildValidationMessages(requestData),
        { signal: controller.signal }
      );
      const validation = parseValidationResponse(validationText);
      if (validation.status === 'needs_clarification') {
        addAssistant(validation.questions.join('\n'), 'clarification');
        return;
      }

      setBusy('generating');
      const generatedText = await streamChat(
        provider,
        buildGenerationMessages(requestData),
        {
          signal: controller.signal,
        }
      );
      const generated = parseGeneratedResponse(generatedText);
      if (generated.status === 'needs_clarification') {
        addAssistant(generated.questions.join('\n'), 'clarification');
        return;
      }

      if (replaceIdentifier(generated.code, targetName) !== generated.code) {
        throw new Error('模型猜测并输出了真实函数名，结果已拒绝，编辑器未修改。');
      }
      const restoredCode = restoreIdentifier(generated.code, targetName);
      if (!isConfirmedTargetUnchanged(
        restoredCode,
        session.language,
        targetName,
        confirmedSignature
      )) {
        throw new Error('生成结果修改或丢失了原目标接口，编辑器未修改。');
      }
      updateSession((current) => ({
        ...current,
        source: restoredCode,
        sources: { ...current.sources, [current.language]: restoredCode },
        targetName: '',
        confirmedSignature: '',
        messages: [
          ...current.messages,
          assistantMessage('代码已写入上方编辑器，可直接微调，或继续描述下一处修改。', 'generated'),
        ],
      }));
    } catch (requestError) {
      if (requestError?.name === 'AbortError') setError('本次请求已取消，编辑器未修改。');
      else setError(requestError?.message || 'LLM 请求失败，编辑器未修改。');
    } finally {
      abortRef.current = null;
      setBusy('');
    }
  };

  const cancel = () => abortRef.current?.abort();

  const copyCode = async () => {
    if (!session.source.trim()) return;
    try {
      await navigator.clipboard.writeText(session.source);
      setCopied(true);
      setError('');
    } catch {
      setError('无法访问剪贴板，请在编辑器中手动全选复制。');
    }
  };

  const reset = () => {
    if (!window.confirm('恢复当前题目的官方模板并清空对话？此操作无法撤销。')) return;
    abortRef.current?.abort();
    const language = session.language;
    const template = problemTemplates?.[language] || '';
    clearSession({
      ...emptyCodeSession(),
      language,
      source: template,
      sources: { cpp: '', python: '', [language]: template },
    });
    setDraft('');
    setError('');
  };

  const clearKey = () => {
    try { clearStoredApiKey(); } catch { /* state is still cleared */ }
    setProvider((current) => ({ ...current, apiKey: '', rememberKey: false }));
  };

  const keyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  if (!ready) return <div className="empty">正在读取本地代码会话…</div>;

  return (
    <div className={`code-chat-page${embedded ? ' embedded' : ''}`}>
      {!embedded && (
        <>
          <div className="page-head code-page-head">
            <div>
              <div className="eyebrow">Describe → Validate → Generate</div>
              <h2>描述实现</h2>
              <div className="sub">只把你明确描述的逻辑翻译成代码；信息不足时模型必须追问，不得自行解题。</div>
            </div>
            <div className="code-local-link" title="此信息只用于本地会话，不会自动发送给 LLM">
              {problemMeta ? `本地关联 · ${problemMeta.id} ${problemMeta.cn || problemMeta.title}` : '独立工作区'}
            </div>
          </div>

          <div className="code-privacy-note">
            题面、题号、标题、标签和 URL 不会自动发送。真实函数名会在本地替换后再请求；参数和描述仍可能暴露题目特征。
          </div>
        </>
      )}

      <section className="code-panel editor-panel">
        <div className="code-panel-head">
          <div>
            <b>代码编辑器</b>
            <span>
              {problemMeta && currentTemplate
                ? `已自动载入题目 ${problemMeta.id} 的官方 ${session.language === 'python' ? 'Python 3' : 'C++17'} 模板`
                : <>粘贴包含输入输出定义的 <code>class Solution</code></>}
            </span>
          </div>
          <div className="code-toolbar">
            <select value={session.language} onChange={(e) => changeLanguage(e.target.value)} disabled={!!busy} aria-label="目标语言">
              <option value="cpp">C++17</option>
              <option value="python">Python 3</option>
            </select>
            <select value={heightKey} onChange={(e) => setHeightKey(e.target.value)} aria-label="编辑器高度">
              <option value="compact">紧凑</option>
              <option value="standard">标准</option>
              <option value="tall">加高</option>
            </select>
            <button className="fbtn" type="button" onClick={copyCode} disabled={!session.source.trim()}>
              {copied ? '✓ 已复制' : '复制代码'}
            </button>
            <button className="fbtn" type="button" onClick={reset}>恢复官方模板</button>
          </div>
        </div>
        <div className="code-editor-shell">
          <CodeEditor
            value={session.source}
            language={session.language}
            height={HEIGHTS[heightKey]}
            onChange={changeSource}
            disabled={!!busy}
          />
        </div>

        <div className={`mask-auto${detection.ok ? '' : ' invalid'}`}>
          {detection.ok ? (
            <>
              <span>发送时自动隐藏函数名</span>
              <code>{detection.targetName}</code><span>→</span><code>__TARGET_FUNCTION__</code>
            </>
          ) : <span>{detection.error}</span>}
        </div>
      </section>

      <section className="code-panel provider-panel">
        <button className="code-panel-toggle" type="button" onClick={() => setProviderOpen((open) => !open)}>
          <span>{providerOpen ? '▾' : '▸'} Provider 设置</span>
          <span className={`provider-state${provider.apiKey && provider.model ? ' ready' : ''}`}>
            {provider.apiKey && provider.model ? `${provider.model} · 已配置` : '尚未配置'}
          </span>
        </button>
        {providerOpen && (
          <div className="provider-form">
            <label>
              <span>OpenAI-compatible Base URL</span>
              <input value={provider.baseUrl} onChange={(e) => setProvider((current) => ({ ...current, baseUrl: e.target.value }))} placeholder="https://api.openai.com/v1" />
            </label>
            <label>
              <span>Model</span>
              <input
                list="detected-llm-models"
                value={provider.model}
                onChange={(e) => setProvider((current) => ({ ...current, model: e.target.value }))}
                placeholder={modelProbe.status === 'loading' ? '正在探测模型…' : '模型名称'}
              />
              <datalist id="detected-llm-models">
                {detectedModels.map((model) => <option value={model} key={model} />)}
              </datalist>
              <div className={`model-probe-state ${modelProbe.status}`}>
                {modelProbe.status === 'loading' && '正在调用 /models…'}
                {modelProbe.status === 'success' && `已探测到 ${detectedModels.length} 个模型，可点击输入框选择`}
                {modelProbe.status === 'error' && (
                  <>
                    <span>{modelProbe.error}</span>
                    <button
                      className="text-btn"
                      type="button"
                      onClick={() => {
                        const controller = new AbortController();
                        modelProbeRef.current?.abort();
                        modelProbeRef.current = controller;
                        probeModels(provider.baseUrl, provider.apiKey, controller.signal);
                      }}
                    >重试</button>
                  </>
                )}
              </div>
            </label>
            <label>
              <span>API key</span>
              <input type="password" autoComplete="off" value={provider.apiKey} onChange={(e) => setProvider((current) => ({ ...current, apiKey: e.target.value }))} placeholder="仅发送给你配置的 Provider" />
            </label>
            <div className="provider-key-row">
              <label className="remember-key">
                <input type="checkbox" checked={provider.rememberKey} onChange={(e) => setProvider((current) => ({ ...current, rememberKey: e.target.checked }))} />
                <span>在此浏览器中记住 key</span>
              </label>
              <button className="text-btn danger" type="button" onClick={clearKey}>清除 key</button>
            </div>
            {provider.rememberKey && <div className="provider-warning">key 将写入 localStorage，同源脚本或 XSS 可能读取。仅在个人可信设备使用。</div>}
            <div className="provider-hint">默认 key 只保留在当前标签页。浏览器直连要求 Provider 允许 CORS；本项目不提供后端代理。</div>
            {(providerError || storageError) && <div className="code-error">{providerError || storageError}</div>}
          </div>
        )}
      </section>

      <section className="code-panel chat-panel">
        <div className="code-panel-head chat-head">
          <div>
            <b>逻辑描述</b>
            <span>完整生成通常调用模型两次：先校验，再生成</span>
          </div>
          {busy && <span className="busy-badge">{busy === 'validating' ? '正在检查描述…' : '正在生成代码…'}</span>}
        </div>

        {session.messages.length > 0 && (
          <div className="code-messages" aria-live="polite">
            {session.messages.map((message) => message.role === 'user'
              ? <UserMessage key={message.id} message={message} />
              : <AssistantMessage key={message.id} message={message} />)}
            <div ref={endRef} />
          </div>
        )}

        {error && <div className="code-error" role="alert">{error}</div>}
        <form className="code-composer" onSubmit={submit}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={keyDown}
            disabled={!!busy}
            rows={4}
            placeholder="按实现顺序描述数据结构、循环、分支、边界处理和返回规则。不要只写算法名称。Enter 发送，Shift+Enter 换行。"
          />
          <div className="composer-actions">
            <span>{detection.ok ? `发送时自动隐藏 ${detection.targetName}` : '发送前会自动检查目标函数'}</span>
            {busy
              ? <button className="code-send cancel" type="button" onClick={cancel}>取消</button>
              : <button className="code-send" type="submit" disabled={!draft.trim()}>校验并生成</button>}
          </div>
        </form>
      </section>
    </div>
  );
}

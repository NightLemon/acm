import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';

export function CodeEditor({ value, language, height, onChange, disabled, entryMode = 'class' }) {
  const viewRef = useRef(null);
  const extensions = useMemo(
    () => [language === 'python' ? python() : cpp()],
    [language]
  );

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  return (
    <CodeMirror
      value={value}
      height={`${height}px`}
      minHeight="220px"
      maxHeight="680px"
      theme="dark"
      extensions={extensions}
      onChange={onChange}
      onCreateEditor={(view) => { viewRef.current = view; }}
      editable={!disabled}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightSpecialChars: true,
        foldGutter: true,
        drawSelection: true,
        dropCursor: true,
        allowMultipleSelections: true,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false,
        rectangularSelection: true,
        crosshairCursor: false,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
        closeBracketsKeymap: true,
        defaultKeymap: true,
        searchKeymap: true,
        historyKeymap: true,
        foldKeymap: true,
        completionKeymap: false,
        lintKeymap: false,
      }}
      placeholder={entryMode === 'function'
        ? language === 'python'
          ? '粘贴顶层 def 函数及调用入口（如 main / solve）...'
          : '粘贴带函数体的普通函数或 int main(...) ...'
        : language === 'python'
          ? '粘贴包含目标方法的 class Solution 或自定义类...'
          : '粘贴包含 public 目标方法的 class Solution 或自定义类...'}
      aria-label="代码编辑器"
    />
  );
}

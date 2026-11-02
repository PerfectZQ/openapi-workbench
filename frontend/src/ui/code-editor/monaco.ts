import * as monaco from 'monaco-editor/editor/editor.api'
export { monaco }
// JSON 的 worker 入口会注册编辑器服务；必须在首个 Go / JSON 编辑器创建前统一加载。
import 'monaco-editor/internal/common/workers'
// 与编辑器同版本交付；已打开的页面在发布替换资源或断网后仍可创建 Worker。
import EditorWorker from 'monaco-editor/editor/editor.worker?worker&inline'

self.MonacoEnvironment = { getWorker: () => new EditorWorker() }

export function editorTypography(element: HTMLElement) {
  const style = getComputedStyle(element)
  return {
    fontFamily: style.getPropertyValue('--font-mono').trim(),
    fontSize: Number.parseFloat(style.getPropertyValue('--code-font-size')),
    lineHeight: Number.parseFloat(style.getPropertyValue('--code-line-height')),
    fontWeight: style.getPropertyValue('--weight-regular').trim(),
  }
}

// Monaco 的主题作用于共享运行时，Go / JSON 必须选择同一个主题以免互相覆盖。
monaco.editor.defineTheme('workbench-light', {
  base: 'vs', inherit: true,
  rules: [
    { token: 'comment', foreground: '608B4E' },
    { token: 'keyword', foreground: '0000FF' },
    { token: 'type.identifier', foreground: '267F99' },
    { token: 'entity.name.function', foreground: '795E26' },
    { token: 'string', foreground: 'A31515' },
    { token: 'number', foreground: '098658' },
    { token: 'identifier', foreground: '001080' },
    { token: 'string.key.json', foreground: '315CA7' },
    { token: 'string.value.json', foreground: '28735D' },
    { token: 'number.json', foreground: '956127' },
    { token: 'keyword.json', foreground: '7950A2' },
  ],
  colors: {
    'editor.background': '#FFFFFF', 'editor.foreground': '#1F1F1F',
    'editorLineNumber.foreground': '#858585', 'editorLineNumber.activeForeground': '#1F1F1F',
    'editor.lineHighlightBackground': '#F5F7FA', 'editor.lineHighlightBorder': '#00000000',
    'editor.selectionBackground': '#ADD6FF', 'editorCursor.foreground': '#2F63D4',
    'editorIndentGuide.background1': '#E6E8EB', 'editorIndentGuide.activeBackground1': '#AEB5C0',
    'editorHoverWidget.background': '#FFFFFF', 'editorHoverWidget.border': '#D8DEE8',
    'editorWidget.background': '#F8FAFC', 'editorWidget.border': '#D8DEE8',
    'peekViewEditor.background': '#F8FAFC', 'peekViewResult.background': '#F2F5F9',
    'peekViewTitle.background': '#EDF2FA', 'peekView.border': '#2F63D4',
  },
})

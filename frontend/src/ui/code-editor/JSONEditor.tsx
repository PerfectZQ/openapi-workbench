import { useTranslation } from 'react-i18next'
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { useReducedMotion } from 'motion/react'
import { editorTypography, monaco } from './monaco'
import 'monaco-editor/languages/features/json/register'
import JSONWorker from 'monaco-editor/languages/features/json/json.worker?worker&inline'
import './json-editor.css'

const workerEnvironment = self.MonacoEnvironment!
self.MonacoEnvironment = { getWorker: (id, label) => label === 'json' ? new JSONWorker() : workerEnvironment.getWorker!(id, label) }

export interface JSONEditorHandle { find: () => void }
export interface JSONEditorProps { text: string; editable: boolean; label?: string; onChange?: (text: string) => void; onFormat?: () => void; ref?: Ref<JSONEditorHandle> }

export default function JSONEditor(props: JSONEditorProps) {
  const { t: tr } = useTranslation()
  const reduceMotion = useReducedMotion()
  const host = useRef<HTMLDivElement>(null)
  const instance = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const latest = useRef(props)
  latest.current = props
  useImperativeHandle(props.ref, () => ({ find: () => { instance.current?.focus(); void instance.current?.getAction('actions.find')?.run() } }), [])
  useEffect(() => {
    const model = monaco.editor.createModel(latest.current.text, 'json')
    const editor = monaco.editor.create(host.current!, {
      model, theme: 'workbench-light', automaticLayout: true, readOnly: !latest.current.editable, ariaLabel: latest.current.label ?? tr('codeEditor.JSONEditor.18bb78b8'),
      ...editorTypography(host.current!), fontFamily: getComputedStyle(host.current!).fontFamily, tabSize: 2,
      minimap: { enabled: false }, lineNumbersMinChars: 3, wordWrap: 'on', folding: true,
      lineDecorationsWidth: 8, renderLineHighlight: 'all', overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true, stickyScroll: { enabled: false }, tabFocusMode: true,
      scrollBeyondLastLine: false, padding: { top: 12, bottom: 12 }, contextmenu: false,
      smoothScrolling: !reduceMotion, bracketPairColorization: { enabled: true },
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, alwaysConsumeMouseWheel: false },
      unicodeHighlight: { ambiguousCharacters: false },
    })
    instance.current = editor
    void document.fonts.ready.then(() => { if (instance.current === editor) monaco.editor.remeasureFonts() })
    const change = model.onDidChangeContent(() => {
      if (model.getValue() !== latest.current.text) latest.current.onChange?.(model.getValue())
    })
    const format = editor.addAction({ id: 'workbench-json.format', label: tr('codeEditor.JSONEditor.a0b38ee0'), keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF], run: () => latest.current.onFormat?.() })
    return () => { format.dispose(); change.dispose(); editor.dispose(); model.dispose(); instance.current = null }
  }, [])
  useEffect(() => { instance.current?.updateOptions({ smoothScrolling: !reduceMotion }) }, [reduceMotion])
  useEffect(() => {
    const editor = instance.current
    if (editor && editor.getValue() !== props.text) {
      const view = editor.saveViewState()
      if (props.editable) {
        editor.pushUndoStop()
        editor.executeEdits('workbench-json', [{ range: editor.getModel()!.getFullModelRange(), text: props.text }])
        editor.pushUndoStop()
      } else editor.getModel()!.setValue(props.text)
      if (view) editor.restoreViewState(view)
    }
    editor?.updateOptions({ readOnly: !props.editable, ariaLabel: props.label ?? tr('codeEditor.JSONEditor.18bb78b8') })
  }, [props.text, props.editable, props.label])
  return <div className="json-editor" ref={host} />
}

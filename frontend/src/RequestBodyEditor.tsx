import { useState, type CSSProperties } from 'react'
import { Braces, Check, CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import JSONEditor from '@workbench/ui/code-editor/JSONEditor'
import { JsonCodeBlock } from '@workbench/ui/JsonCodeBlock'
import { CopyButton } from '@workbench/ui/CopyButton'
import './request-body-editor.css'

export function RequestBodyEditor({
  value,
  onChange,
  onFormat,
}: {
  value: string
  onChange(value: string): void
  onFormat(): void
}) {
  const { t } = useTranslation()
  const [codeMode, setCodeMode] = useState(() => !matchMedia('(pointer: coarse)').matches)
  const lineCount = value.split('\n').length
  const height = Math.min(320, Math.max(104, lineCount * 20 + 24))
  let valid = true
  try {
    JSON.parse(value)
  } catch {
    valid = false
  }
  return (
    <div className="request-body-editor">
      <div className="editor-toolbar">
        <span className="editor-filename">
          <Braces size={14} />
          <code>request.json</code>
        </span>
        <div className="editor-tools">
          <button onClick={onFormat} type="button" title={t('swagger.formatShortcut')}>
            <Braces size={14} />
            {t('swagger.format')}
          </button>
          <CopyButton value={value} />
        </div>
      </div>
      <div className="request-editor-surface" style={{ '--request-editor-height': `${height}px` } as CSSProperties}>
        {codeMode ? (
          <JSONEditor text={value} editable label={t('swagger.body')} onChange={onChange} onFormat={onFormat} />
        ) : (
          <JsonCodeBlock text={value} label={t('swagger.body')} onChange={onChange} invalid={!valid} />
        )}
      </div>
      <div className="request-editor-status">
        <span className={valid ? 'editor-valid' : 'editor-invalid'}>
          {valid ? <Check size={12} /> : <CircleAlert size={12} />}
          {t(valid ? 'swagger.validJSON' : 'swagger.invalidJSON')}
        </span>
        <span>{t('swagger.lineCount', { count: lineCount })}</span>
        <span>JSON</span>
        {!codeMode && (
          <button type="button" onClick={() => setCodeMode(true)}>
            {t('swagger.codeMode')}
          </button>
        )}
      </div>
    </div>
  )
}

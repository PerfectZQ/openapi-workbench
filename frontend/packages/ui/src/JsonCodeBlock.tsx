import './json-code-block.css'
import { useRef } from 'react'

// React 按文本渲染 token，JSON 字符串里的 HTML 不进入 DOM。
function JsonTokens({ text }: { text: string }) {
  return text.split(/("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g).map((token, index) => {
    const tone = token.startsWith('"') ? (token.trimEnd().endsWith(':') ? 'key' : 'string') : /^(true|false|null)$/.test(token) ? 'literal' : /^-?\d/.test(token) ? 'number' : ''
    return tone ? <span key={index} className={`json-token-${tone}`}>{token}</span> : token
  })
}

export function JsonCodeBlock({ text, label, onChange, invalid = false, describedBy }: { text: string; label: string; onChange?: (text: string) => void; invalid?: boolean; describedBy?: string }) {
  const preview = useRef<HTMLPreElement>(null)
  return <div className={`json-code-block ${onChange ? 'is-editable' : ''}`}>
    {!onChange && <div className="json-code-language"><span>JSON</span></div>}
    <div className="json-code-body" style={onChange ? { height: `${Math.min(16, Math.max(4, text.split('\n').length + 1)) * 20 + 24}px` } : undefined}>
      <pre ref={preview} aria-hidden={onChange ? true : undefined} aria-label={onChange ? undefined : label} tabIndex={onChange ? undefined : 0}><code className="language-json">{text.length > 65536 ? text : <JsonTokens text={text} />}{'\n'}</code></pre>
      {onChange && <textarea aria-label={label} aria-invalid={invalid} aria-describedby={describedBy} spellCheck={false} wrap="off" autoCapitalize="off" autoComplete="off" value={text} onChange={(event) => onChange(event.target.value)} onScroll={(event) => {
        if (preview.current) { preview.current.scrollTop = event.currentTarget.scrollTop; preview.current.scrollLeft = event.currentTarget.scrollLeft }
      }} />}
    </div>
  </div>
}

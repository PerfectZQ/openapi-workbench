import { useMemo } from 'react'

/** Render tokens as React text nodes; response content is never interpreted as HTML. */
export function CodeBlock({
  value,
  json = false,
  wrap = false,
  className = '',
}: {
  value: string
  json?: boolean
  wrap?: boolean
  className?: string
}) {
  const content = useMemo(() => {
    if (value.length > 100_000) return value
    const lines = value.split('\n')
    return lines.map((line, lineIndex) => {
      const tokens = json
        ? line.split(
            /("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g,
          )
        : [line]
      return (
        <span className="api-code-line" data-line={lineIndex + 1} key={lineIndex}>
          <code>
            {tokens.map((token, index) =>
              index % 2 === 0 ? (
                token
              ) : (
                <span
                  key={index}
                  className={`json-${token.startsWith('"') ? (token.trimEnd().endsWith(':') ? 'key' : 'string') : /true|false|null/.test(token) ? 'literal' : 'number'}`}
                >
                  {token}
                </span>
              ),
            )}
            {lineIndex < lines.length - 1 ? '\n' : ''}
          </code>
        </span>
      )
    })
  }, [value, json])
  return (
    <pre tabIndex={0} className={`api-code ${wrap ? 'is-wrapped' : ''} ${className}`}>
      {content}
    </pre>
  )
}

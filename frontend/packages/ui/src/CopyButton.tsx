import { useEffect, useRef, useState } from 'react'
import { Check, Copy, CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import './copy-button.css'

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const revision = useRef(0)
  useEffect(() => {
    setState('idle')
    return () => { revision.current++; clearTimeout(timer.current) }
  }, [value])

  async function copy() {
    if (state === 'copying') return
    const current = revision.current
    clearTimeout(timer.current)
    setState('copying')
    try {
      await navigator.clipboard.writeText(value)
      if (current !== revision.current) return
      setState('copied')
      timer.current = setTimeout(() => setState('idle'), 1800)
    } catch {
      if (current === revision.current) setState('failed')
    }
  }

  const feedback = state === 'copied' || state === 'failed' ? t(`copyButton.${state}`) : ''
  const action = label ?? t('copyButton.copy')
  return <span className="copy-control" data-state={state}>
    <button type="button" className="copy-button" aria-label={action} title={feedback || action} aria-busy={state === 'copying'} onClick={event => { event.stopPropagation(); void copy() }}>
      {state === 'copied' ? <Check size={14} aria-hidden="true" /> : state === 'failed' ? <CircleAlert size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>
    <span className="copy-feedback" role="status">{feedback}</span>
  </span>
}

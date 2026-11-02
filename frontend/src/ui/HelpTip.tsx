import { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ComponentPropsWithRef, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from './CopyButton'
import './help-tip.css'

let closeActiveHelpTip: (() => void) | undefined

export function HelpTipIcon() {
  return <span className="help-tip-icon" aria-hidden="true">?</span>
}

export type HelpTipProps = {
  label: string
  wide?: boolean
  placement?: 'auto' | 'right'
  interactive?: boolean
  trigger?: ReactElement<ComponentPropsWithRef<'button'>>
  actions?: ReactNode
} & ({ copyable: true; description: string } | { copyable?: false; description: ReactNode })

export function HelpTip({ label, description, copyable, wide = false, placement = 'auto', interactive = false, trigger, actions }: HelpTipProps) {
  const { t } = useTranslation()
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pinned = useRef(false)
  const restoringFocus = useRef(false)
  const [open, setOpen] = useState(false)

  const close = useCallback(() => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
    pinned.current = false
    if (closeActiveHelpTip === close) closeActiveHelpTip = undefined
    setOpen(false)
  }, [])

  const restoreFocus = () => {
    restoringFocus.current = true
    triggerRef.current?.focus({ preventScroll: true })
    restoringFocus.current = false
  }
  const show = () => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
    if (closeActiveHelpTip !== close) closeActiveHelpTip?.()
    closeActiveHelpTip = close
    setOpen(true)
  }
  const preview = () => {
    clearTimeout(closeTimer.current)
    clearTimeout(openTimer.current)
    if (!open) openTimer.current = setTimeout(show, 160)
  }
  const leave = () => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      if (!pinned.current && !triggerRef.current?.matches(':focus-visible') && !panelRef.current?.contains(document.activeElement)) close()
    }, 80)
  }

  useEffect(() => () => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
    if (closeActiveHelpTip === close) closeActiveHelpTip = undefined
  }, [close])

  useLayoutEffect(() => {
    const panel = panelRef.current
    const anchor = triggerRef.current
    if (!open || !panel || !anchor) return
    // 顶层浮层保留在所属模态框内，同时避开画布与滚动容器的裁切。
    panel.showPopover()
    const position = () => {
      const rect = anchor.getBoundingClientRect()
      const viewport = window.visualViewport
      const viewportLeft = viewport?.offsetLeft ?? 0
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportWidth = viewport?.width ?? document.documentElement.clientWidth
      const viewportHeight = viewport?.height ?? window.innerHeight
      const rightEdge = viewportLeft + viewportWidth - 12
      const bottomEdge = viewportTop + viewportHeight - 12
      const width = Math.min(wide ? 520 : 360, viewportWidth - 24)
      panel.style.width = copyable ? 'max-content' : `${width}px`
      panel.style.maxWidth = `${width}px`
      panel.style.maxHeight = `${viewportHeight - 24}px`
      const rightSpace = rightEdge - rect.right - 8
      const beside = placement === 'right' && rightSpace >= 280
      if (beside) panel.style.width = `${Math.min(width, rightSpace)}px`
      const height = panel.offsetHeight
      const belowSpace = bottomEdge - rect.bottom - 8
      const aboveSpace = rect.top - viewportTop - 20
      const above = !beside && height > belowSpace && aboveSpace > belowSpace
      const maxHeight = beside ? viewportHeight - 24 : Math.max(80, above ? aboveSpace : belowSpace)
      panel.style.maxHeight = `${Math.min(viewportHeight - 24, maxHeight)}px`
      const x = beside ? rect.right + 8 : rect.left + rect.width / 2 - panel.offsetWidth / 2
      const y = beside ? rect.top : above ? rect.top - Math.min(height, maxHeight) - 8 : rect.bottom + 8
      panel.style.left = `${Math.max(viewportLeft + 12, Math.min(x, rightEdge - panel.offsetWidth))}px`
      panel.style.top = `${Math.max(viewportTop + 12, Math.min(y, bottomEdge - panel.offsetHeight))}px`
    }
    const scroll = (event: Event) => {
      if (panel.contains(event.target as globalThis.Node)) return
      const rect = anchor.getBoundingClientRect()
      if (rect.bottom <= 0 || rect.top >= window.innerHeight || !anchor.getClientRects().length) close()
      else position()
    }
    const outside = (event: PointerEvent) => {
      if (!anchor.contains(event.target as globalThis.Node) && !panel.contains(event.target as globalThis.Node)) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (panel.contains(document.activeElement)) restoreFocus()
      close()
    }
    position()
    const observer = new ResizeObserver(position)
    observer.observe(panel)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    document.addEventListener('dragstart', close, true)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', scroll, true)
    window.visualViewport?.addEventListener('resize', position)
    window.visualViewport?.addEventListener('scroll', position)
    return () => {
      observer.disconnect()
      if (panel.matches(':popover-open')) panel.hidePopover()
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape, true)
      document.removeEventListener('dragstart', close, true)
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', scroll, true)
      window.visualViewport?.removeEventListener('resize', position)
      window.visualViewport?.removeEventListener('scroll', position)
    }
  }, [open, wide, placement, copyable, close])

  const button = cloneElement<ComponentPropsWithRef<'button'>>(trigger ?? <button type="button" className="help-tip-trigger" aria-label={t('helpTip.fd066d54', { arg0: label })}><HelpTipIcon /></button>, {
    ref: triggerRef,
    'aria-describedby': [trigger?.props['aria-describedby'], open ? `${id}-content` : undefined].filter(Boolean).join(' ') || undefined,
    'aria-controls': open ? id : undefined,
    'aria-expanded': open,
    'aria-haspopup': interactive || !trigger ? 'dialog' : trigger.props['aria-haspopup'],
    onClick: event => {
      if (trigger && !interactive) { close(); trigger.props.onClick?.(event); return }
      event.preventDefault()
      event.stopPropagation()
      if (pinned.current) close()
      else { pinned.current = true; show() }
    },
    onFocus: event => {
      trigger?.props.onFocus?.(event)
      if (!restoringFocus.current && event.currentTarget.matches(':focus-visible')) show()
    },
    onBlur: event => {
      trigger?.props.onBlur?.(event)
      if (!panelRef.current?.contains(event.relatedTarget)) close()
    },
    onKeyDown: event => {
      trigger?.props.onKeyDown?.(event)
      if (!event.defaultPrevented && event.key === 'Tab' && !event.shiftKey && open) {
        event.preventDefault()
        event.stopPropagation()
        contentRef.current?.focus()
      }
    },
    onPointerEnter: event => { trigger?.props.onPointerEnter?.(event); if (event.pointerType === 'mouse') preview() },
    onPointerLeave: event => { trigger?.props.onPointerLeave?.(event); leave() },
  })

  const tooltip = open && createPortal(
    <div ref={panelRef} id={id} popover="manual" role="dialog" aria-label={copyable ? label : undefined} aria-labelledby={copyable ? undefined : `${id}-title`} className={`help-tooltip${copyable ? ' is-copyable' : ''}`}
      onToggle={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
      onPointerEnter={() => clearTimeout(closeTimer.current)} onPointerLeave={leave}
      onBlur={event => { if (!triggerRef.current?.contains(event.relatedTarget) && !event.currentTarget.contains(event.relatedTarget)) close() }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        event.stopPropagation()
        const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]')]
        if (event.shiftKey && (event.target === contentRef.current || event.target === focusable[0])) {
          event.preventDefault()
          restoreFocus()
        } else if (!event.shiftKey && event.target === focusable.at(-1)) {
          restoreFocus()
          close()
        }
      }}>
      {!copyable && <header className="help-tooltip-header"><h2 id={`${id}-title`}>{label}</h2></header>}
      <div ref={contentRef} id={`${id}-content`} className="help-tooltip-content" tabIndex={0} aria-label={t('helpTip.5d17cf9f', { arg0: label })}>
        {copyable ? <span className="help-tooltip-value">{description}</span> : typeof description === 'string' ? description.split(/\n+/).map(part => part.trim()).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>) : description}
      </div>
      {copyable && <CopyButton value={description} label={t('copyButton.copyLabel', { label })} />}
      {actions && <footer className="help-tooltip-actions" onClick={event => {
        if (!event.defaultPrevented && (event.target as Element).closest('button:not(:disabled), a[href]')) close()
      }}>{actions}</footer>}
      {!copyable && <button type="button" className="help-tooltip-close" aria-label={t('helpTip.close')} onClick={() => { restoreFocus(); close() }}><X size={16} aria-hidden="true" /></button>}
    </div>, triggerRef.current?.closest('dialog, [popover]') ?? document.body,
  )
  return trigger ? <>{button}{tooltip}</> : <span className="help-tip">{button}{tooltip}</span>
}

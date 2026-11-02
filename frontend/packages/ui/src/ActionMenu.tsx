import './action-menu.css'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

const itemSelector = 'button:not(:disabled), a[href]'

export function ActionMenu({ children, disabled, label, description, icon, triggerClassName }: { children: ReactNode; disabled?: boolean; label: string; description?: string; icon: ReactNode; triggerClassName: string }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      if (!(event.target instanceof Node) || !panel.current?.contains(event.target)) panel.current?.hidePopover()
    }
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return <>
    <button ref={trigger} type="button" className={triggerClassName} disabled={disabled}
      popoverTarget={id} aria-label={label} aria-description={description} title={description} aria-haspopup="dialog" aria-expanded={open}
      onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); panel.current?.showPopover() } }}>
      {icon}<span>{label}</span>
    </button>
    <div ref={panel} id={id} popover="auto" role="dialog" aria-label={label} className="action-menu" style={position}
      onToggle={event => {
        const opened = event.newState === 'open'
        setOpen(opened)
        if (!opened) {
          if (document.activeElement === document.body || event.currentTarget.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true })
          return
        }
        const anchor = trigger.current!.getBoundingClientRect()
        const bounds = event.currentTarget.getBoundingClientRect()
        setPosition({
          left: Math.max(12, Math.min(anchor.left, window.innerWidth - bounds.width - 12)),
          top: Math.max(12, anchor.bottom + bounds.height + 18 <= window.innerHeight ? anchor.bottom + 6 : anchor.top - bounds.height - 6),
        })
        event.currentTarget.querySelector<HTMLElement>(itemSelector)?.focus({ preventScroll: true })
      }}
      onClickCapture={event => {
        if ((event.target as Element).closest('[aria-disabled="true"], .help-tooltip') || !(event.target as Element).closest(itemSelector)) return
        panel.current?.hidePopover()
        trigger.current?.focus({ preventScroll: true })
      }}
      onKeyDown={event => {
        if (event.defaultPrevented || (event.target as Element).closest('.help-tooltip') || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>(itemSelector)]
        if (!items.length) return
        event.preventDefault()
        const index = items.indexOf(document.activeElement as HTMLElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next].focus()
      }}
      onBlur={event => {
        const next = event.relatedTarget as HTMLElement | null
        if (next && next !== document.body && !event.currentTarget.contains(next)) panel.current?.hidePopover()
      }}>
      {children}
    </div>
  </>
}

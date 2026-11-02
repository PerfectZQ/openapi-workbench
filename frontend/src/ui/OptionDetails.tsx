import { useTranslation } from 'react-i18next'
import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { Info, X } from 'lucide-react'
import './option-details.css'

// 原生 Popover 脱离菜单的裁切和定位变换，同时留在所属菜单 / dialog 的焦点范围内。
export function OptionDetails({ label, description, value, preview = false, children }: {
  label: string
  description?: string
  value?: string
  preview?: boolean
  children: ReactElement<{ 'aria-describedby'?: string }>
}) {
  const { t: tr } = useTranslation()
  const id = useId()
  const row = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const restoringFocus = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const identifier = value && value !== label ? value : undefined

  useEffect(() => {
    if (preview) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setOpen(preview)
  }, [preview])
  useEffect(() => () => clearTimeout(timer.current), [])

  const close = (restoreFocus = false) => {
    clearTimeout(timer.current)
    setOpen(false)
    if (restoreFocus) {
      restoringFocus.current = true
      returnFocus.current?.focus()
      restoringFocus.current = false
    }
  }
  const read = () => {
    clearTimeout(timer.current)
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setOpen(true)
  }

  useLayoutEffect(() => {
    const popup = panel.current
    const anchor = row.current
    if (!open || !popup || !anchor) return
    popup.showPopover()
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const menu = anchor.closest('[popover], [role="listbox"]')
      const bounds = menu?.getBoundingClientRect() ?? rect
      const width = Math.min(360, window.innerWidth - 24)
      const right = window.innerWidth - bounds.right - 22
      const left = bounds.left - 22
      const beside = Math.max(right, left) >= width
      popup.style.width = `${width}px`
      popup.style.maxHeight = `${Math.max(80, Math.min(beside ? 520 : 240, window.innerHeight - 24))}px`
      const height = popup.getBoundingClientRect().height
      const x = beside ? right >= width ? bounds.right + 10 : bounds.left - width - 10 : Math.min(bounds.left, window.innerWidth - width - 12)
      const below = window.innerHeight - bounds.bottom - 22
      const y = beside ? rect.top : below >= height ? bounds.bottom + 10 : bounds.top >= height + 22 ? bounds.top - height - 10 : window.innerHeight - height - 12
      popup.style.left = `${Math.max(12, x)}px`
      popup.style.top = `${Math.max(12, Math.min(y, window.innerHeight - height - 12))}px`
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(popup)
    const scroll = (event: Event) => {
      if (!popup.contains(event.target as globalThis.Node)) close()
    }
    const outside = (event: PointerEvent) => {
      if (!anchor.contains(event.target as globalThis.Node)) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      close(popup.contains(document.activeElement))
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', scroll, true)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', scroll, true)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape, true)
      if (popup.matches(':popover-open')) popup.hidePopover()
    }
  }, [open])

  if (!description && !identifier) return children

  return <div ref={row} className="option-with-details"
    onPointerEnter={event => {
      if (event.pointerType !== 'mouse') return
      clearTimeout(timer.current)
      timer.current = setTimeout(read, 180)
    }}
    onPointerLeave={() => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => { if (!row.current?.contains(document.activeElement)) close() }, 150)
    }}
    onFocus={event => { if (!restoringFocus.current && !open && event.target.matches(':focus-visible') && !panel.current?.contains(event.target)) read() }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close() }}
    onKeyDownCapture={event => {
      if (event.key === 'ArrowRight' && !panel.current?.contains(event.target as globalThis.Node)) {
        event.preventDefault(); event.stopPropagation(); read()
        row.current?.querySelector<HTMLButtonElement>('.option-details-trigger')?.focus()
      }
    }}>
    {cloneElement(children, { 'aria-describedby': open ? id : undefined })}
    <button type="button" className="option-details-trigger" aria-label={tr('optionDetails.a67ba51a', {arg0: (label)})} aria-expanded={open} aria-controls={id}
      onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); read() }}
      onKeyDown={event => {
        if (event.key === 'Tab' && open && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); panel.current?.focus() }
      }}><Info size={15} aria-hidden="true" /></button>
    <div ref={panel} id={id} popover="manual" role="region" aria-label={tr('optionDetails.ccf83c05', {arg0: (label)})} tabIndex={-1} className="option-details-popover"
      onToggle={event => event.stopPropagation()}
      onPointerEnter={() => clearTimeout(timer.current)}
      onKeyDown={event => {
        if (event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); close(true) }
        else event.stopPropagation()
      }}>
      <header><strong>{label}</strong><button type="button" aria-label={tr('optionDetails.4cfed70f')} onClick={() => close(true)}><X size={16} /></button></header>
      {description && <p>{description}</p>}
      {identifier && <dl><dt>{tr('optionDetails.3537d5ef')}</dt><dd><code>{identifier}</code></dd></dl>}
    </div>
  </div>
}

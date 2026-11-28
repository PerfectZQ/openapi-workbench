import { Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef, type OptionHTMLAttributes, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OptionDetails } from './OptionDetails'
import './select.css'

export interface SelectOption {
  value: string
  label: string
  identifier?: string
  description?: string
  disabled?: boolean
}

export interface SelectProps extends Omit<ComponentPropsWithoutRef<'button'>, 'value' | 'defaultValue' | 'onChange' | 'children'> {
  value?: string | number
  onValueChange?: (value: string, option: SelectOption) => void
  children: ReactNode
  placeholder?: string
  searchPlaceholder?: string
  // 远程候选只在非空关键词下读取；children 保留当前选择和清空选项。
  loadOptions?: (keyword: string, signal: AbortSignal) => Promise<SelectOption[]>
  optionIcons?: Readonly<Record<string, ReactNode>>
  optionBadges?: Readonly<Record<string, ReactNode>>
  showOptionDetails?: boolean
  readOnly?: boolean
  renderTrigger?: (button: ReactElement<ComponentPropsWithoutRef<'button'>>) => ReactNode
  onCloseAutoFocus?: (event: Event) => void
}

function optionText(value: ReactNode): string {
  return Children.toArray(value).map(child => isValidElement<{ children?: ReactNode }>(child) ? optionText(child.props.children) : String(child)).join('')
}

// 所有单选共用搜索与键盘行为；原生 Popover 管理顶层显示、嵌套和区域外关闭。
export function Select({ value = '', onValueChange, children, placeholder, searchPlaceholder, loadOptions, optionIcons, optionBadges, showOptionDetails = true, onCloseAutoFocus, readOnly = false, renderTrigger = button => button, className = '', disabled, name, id, onClick, onKeyDown, ...props }: SelectProps) {
  const { t: tr } = useTranslation()
  const menuID = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const opened = useRef(false)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const attachTrigger = useCallback((element: HTMLButtonElement | null) => {
    trigger.current = element
    if (element) setPortalContainer(element.closest<HTMLElement>('dialog, [popover]'))
  }, [])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string>()
  const [composing, setComposing] = useState(false)
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ keyword: string; options?: SelectOption[]; failed?: boolean }>()
  const loader = useRef(loadOptions)
  loader.current = loadOptions
  const remote = !!loadOptions
  const keyword = query.trim()
  const current = result?.keyword === keyword ? result : undefined
  const loading = open && remote && !!keyword && !composing && !current
  const options: SelectOption[] = Children.toArray(children).flatMap(child => {
    if (!isValidElement<OptionHTMLAttributes<HTMLOptionElement> & { 'data-identifier'?: string }>(child)) return []
    const label = child.props.label ?? optionText(child.props.children)
    const value = String(child.props.value ?? label)
    return [{ value, identifier: child.props['data-identifier'] ?? value, label, description: child.props.title, disabled: child.props.disabled }]
  })
  const selected = options.find(option => option.value === String(value))
  const matches = remote && keyword
    ? composing ? [] : current?.options ?? []
    : options.filter(option => `${option.label} ${option.identifier ?? option.value} ${option.value} ${option.description ?? ''}`.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()))
  const available = matches.filter(option => !option.disabled)
  const activeValue = available.some(option => option.value === active) ? active : available[0]?.value
  const activeIndex = matches.findIndex(option => option.value === activeValue)
  const label = props['aria-label'] || tr('select.382f4b55')
  const selection = <span className={optionIcons ? 'select-value-with-icon' : undefined}>{optionIcons?.[String(value)]}<span>{selected?.label || String(value) || placeholder || tr('select.382f4b55')}</span></span>

  const close = (restoreFocus?: boolean) => {
    if (!opened.current) return
    opened.current = false
    const focusInside = menu.current?.contains(document.activeElement) || document.activeElement === document.body
    if (menu.current?.matches(':popover-open')) menu.current.hidePopover()
    setOpen(false)
    setResult(undefined)
    setComposing(false)
    const event = new Event('select.close', { cancelable: true })
    onCloseAutoFocus?.(event)
    if (!event.defaultPrevented && (restoreFocus ?? focusInside)) trigger.current?.focus({ preventScroll: true })
  }
  const choose = (next: string) => {
    const option = available.find(option => option.value === next)
    if (!option || disabled || readOnly) return
    if (next !== String(value)) onValueChange?.(next, option)
    close(true)
  }

  useEffect(() => {
    if (!open || !remote || !keyword || composing || disabled || readOnly) return
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const options = await loader.current!(keyword, controller.signal)
        if (!controller.signal.aborted) setResult({ keyword, options })
      } catch {
        if (!controller.signal.aborted) setResult({ keyword, failed: true })
      }
    }, 300)
    return () => { clearTimeout(timeout); controller.abort() }
  }, [open, remote, keyword, composing, disabled, readOnly, retry])

  useLayoutEffect(() => {
    const popup = menu.current
    const anchor = trigger.current
    if (!open) return
    if (disabled || readOnly) { close(); return }
    if (!popup || !anchor) return
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const viewport = window.visualViewport
      const left = (viewport?.offsetLeft ?? 0) + 12
      const top = (viewport?.offsetTop ?? 0) + 12
      const right = left + (viewport?.width ?? window.innerWidth) - 24
      const bottom = top + (viewport?.height ?? window.innerHeight) - 24
      const width = Math.min(Math.max(rect.width, 280), right - left)
      const below = bottom - rect.bottom - 6
      const above = rect.top - top - 6
      const placeBelow = below >= Math.min(360, above)
      popup.style.width = `${width}px`
      popup.style.maxHeight = `${Math.max(0, Math.min(480, placeBelow ? below : above))}px`
      popup.style.left = `${Math.max(left, Math.min(rect.left, right - width))}px`
      popup.style.top = `${placeBelow ? rect.bottom + 6 : Math.max(top, rect.top - popup.getBoundingClientRect().height - 6)}px`
    }
    place()
    input.current?.focus({ preventScroll: true })
    const observer = new ResizeObserver(place)
    observer.observe(popup)
    observer.observe(anchor)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    window.visualViewport?.addEventListener('scroll', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('scroll', place)
      if (popup.matches(':popover-open')) popup.hidePopover()
    }
  }, [open, disabled, readOnly, portalContainer])

  useLayoutEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>('[data-highlighted]')?.scrollIntoView({ block: 'nearest' })
  }, [open, activeValue, query])

  return <>
    {name && <input type="hidden" name={name} value={String(value)} disabled={disabled} />}
    {renderTrigger(<button ref={attachTrigger} type="button" popoverTarget={readOnly ? undefined : menuID} aria-disabled={readOnly || undefined} role="combobox" aria-haspopup="dialog" aria-expanded={open} aria-controls={menuID}
      title={selected ? [selected.label, selected.description, showOptionDetails && selected.identifier && selected.identifier !== selected.label ? tr('select.944eaaa9', { arg0: selected.identifier }) : ''].filter(Boolean).join('\n') : undefined}
      {...props} id={id} disabled={disabled} data-state={open ? 'open' : 'closed'} className={`select-trigger ${className}`.trim()}
      onClick={onClick}
      onKeyDown={event => {
        onKeyDown?.(event)
        if (readOnly || event.defaultPrevented || event.nativeEvent.isComposing) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (!open) event.currentTarget.click() }
      }}>
      {selection}<ChevronDown className="select-chevron" size={14} aria-hidden="true" />
    </button>)}
    {createPortal(<div ref={menu} id={menuID} popover="auto" role="dialog" aria-label={label} className="select-menu"
      onToggle={event => {
        event.stopPropagation()
        if (event.target !== event.currentTarget) return
        if (event.newState === 'closed') close()
        else {
          opened.current = true
          setQuery('')
          setActive(selected && !selected.disabled ? selected.value : undefined)
          setOpen(true)
        }
      }}
      onBlur={event => { if (event.relatedTarget && event.relatedTarget !== document.body && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) close(false) }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.defaultPrevented || (event.target as Element).closest('.option-details-popover')) return
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true) }
        else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || ((event.key === 'Home' || event.key === 'End') && (event.ctrlKey || event.metaKey || event.target !== input.current))) {
          event.preventDefault()
          if (!available.length) return
          const index = available.findIndex(option => option.value === activeValue)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + available.length) % available.length
          setActive(available[next].value)
          input.current?.focus({ preventScroll: true })
        } else if (event.key === 'ArrowRight' && event.altKey && event.target === input.current) {
          event.preventDefault()
          const details = list.current?.querySelector<HTMLElement>('[data-highlighted]')?.parentElement?.querySelector<HTMLButtonElement>('.option-details-trigger')
          details?.focus(); details?.click()
        }
      }}>
      <div className="select-search"><Search size={16} aria-hidden="true" />
        <input ref={input} type="search" role="combobox" aria-label={tr('select.search')} placeholder={searchPlaceholder || tr(remote ? 'select.remotePlaceholder' : 'select.searchPlaceholder')}
          aria-expanded={open} aria-autocomplete="list" aria-controls={`${menuID}-list`} aria-activedescendant={activeIndex >= 0 ? `${menuID}-option-${activeIndex}` : undefined}
          autoComplete="off" value={query} onChange={event => {
            if (event.target.value.trim() !== keyword) setResult(undefined)
            setQuery(event.target.value); setActive(undefined)
          }}
          onCompositionStart={() => { setComposing(true); setResult(undefined) }} onCompositionEnd={() => setComposing(false)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing && !composing) { event.preventDefault(); if (activeValue !== undefined) choose(activeValue) }
          }} />
        {query && <button type="button" aria-label={tr('select.clearSearch')} onClick={() => { setQuery(''); setResult(undefined); setActive(String(value)); input.current?.focus() }}><X size={15} aria-hidden="true" /></button>}
      </div>
      <div ref={list} id={`${menuID}-list`} role="listbox" aria-label={label} aria-busy={loading || undefined} data-scroll-hints className="select-viewport">
        {open && matches.map((option, index) => <OptionDetails key={option.value} label={option.label} description={showOptionDetails ? option.description : undefined} value={showOptionDetails ? option.identifier ?? option.value : undefined}>
          <button type="button" id={`${menuID}-option-${index}`} role="option" aria-selected={option.value === String(value)} disabled={option.disabled} tabIndex={-1}
            className="select-option" data-state={option.value === String(value) ? 'checked' : 'unchecked'} data-highlighted={option.value === activeValue || undefined} data-disabled={option.disabled || undefined}
            onPointerMove={event => { if (event.pointerType === 'mouse' && !option.disabled) setActive(option.value) }} onClick={() => choose(option.value)}>
            <span className={optionIcons ? 'select-value-with-icon' : undefined}>{optionIcons?.[option.value]}{option.label}</span>{optionBadges?.[option.value]}
            {option.value === String(value) && <Check className="select-check" size={15} aria-hidden="true" />}
          </button>
        </OptionDetails>)}
      </div>
      {open && remote && !keyword ? <p className="select-empty" role="status">{tr('select.remotePlaceholder')}</p>
        : open && loading ? <p className="select-empty" role="status">{tr('select.loading')}</p>
        : open && remote && current?.failed ? <div className="select-search-error" role="alert"><p>{tr('select.searchFailed')}</p><button type="button" onClick={() => { setResult(undefined); setRetry(value => value + 1); input.current?.focus() }}>{tr('select.retry')}</button></div>
        : open && !composing && !matches.length && <p className="select-empty" role="status">{tr('select.noResults')}</p>}
    </div>, portalContainer ?? document.body)}
  </>
}

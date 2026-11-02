import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export function CatalogResizeHandle() {
  const { t } = useTranslation()
  const handle = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; width: number } | null>(null)
  const sidebar = () => handle.current!.parentElement!
  const layout = () => sidebar().parentElement!
  const dimensions = () => {
    const element = sidebar()
    const style = getComputedStyle(element)
    return {
      width: element.getBoundingClientRect().width,
      min: parseFloat(style.minWidth),
      max: parseFloat(style.maxWidth),
    }
  }
  const resize = (width: number) => {
    const { min, max } = dimensions()
    layout().style.setProperty('--api-catalog-width', `${Math.min(max, Math.max(min, width))}px`)
  }
  const finish = () => {
    drag.current = null
    layout().removeAttribute('data-resizing-catalog')
  }
  const reset = () => layout().style.removeProperty('--api-catalog-width')

  useEffect(() => {
    const root = layout()
    const element = sidebar()
    const observer = new ResizeObserver(() => {
      if (!element.getClientRects().length) {
        finish()
        return
      }
      const { width, min, max } = dimensions()
      handle.current!.setAttribute('aria-valuemin', String(Math.round(min)))
      handle.current!.setAttribute('aria-valuemax', String(Math.round(max)))
      handle.current!.setAttribute('aria-valuenow', String(Math.round(width)))
      handle.current!.setAttribute('aria-valuetext', t('swagger.catalogWidth', { width: Math.round(width) }))
    })
    observer.observe(root)
    observer.observe(element)
    window.addEventListener('blur', finish)
    return () => {
      observer.disconnect()
      window.removeEventListener('blur', finish)
      root.removeAttribute('data-resizing-catalog')
    }
  }, [t])

  return (
    <div
      ref={handle}
      className="catalog-resize-handle"
      role="separator"
      tabIndex={0}
      aria-label={t('swagger.resizeCatalog')}
      aria-controls="api-sidebar"
      aria-orientation="vertical"
      title={t('swagger.resizeCatalogHint')}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.focus()
        drag.current = { x: event.clientX, width: dimensions().width }
        layout().setAttribute('data-resizing-catalog', '')
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (drag.current) resize(drag.current.width + event.clientX - drag.current.x)
      }}
      onPointerUp={(event) => {
        finish()
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      onDoubleClick={reset}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          reset()
          return
        }
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const { width, min, max } = dimensions()
        resize(event.key === 'Home' ? min : event.key === 'End' ? max
          : width + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 48 : 16))
      }}
    />
  )
}

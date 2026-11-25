import { useEffect } from 'react'
import './scroll-hints.css'

// 原生正文只增强明确标记的滚动区；文本框与 Monaco 仅调整滑块颜色。
export function ScrollHints() {
  useEffect(() => {
    const contentSelector = '[data-scroll-hints], .scroll-hints'
    const sliderSelector = '.monaco-scrollable-element > .scrollbar > .slider'
    const selector = `${contentSelector}, textarea, ${sliderSelector}`
    const regions = new Map<HTMLElement, Set<Element>>()
    const pending = new Set<HTMLElement>()
    const desktop = matchMedia('(min-width: 821px)')
    let frame = 0

    const setValue = (element: HTMLElement, name: string, value: string) => {
      if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value)
    }
    const setThumbStrength = (element: HTMLElement, axis: 'x' | 'y', length: number) => {
      // 48px 以下突出短滑块，320px 以上保持克制；中间按实际长度连续减淡。
      const strength = desktop.matches ? 62 - Math.min(1, Math.max(0, (length - 48) / 272)) * 48 : 62
      setValue(element, `--scroll-thumb-strength-${axis}`, `${strength.toFixed(1)}%`)
    }
    const measure = (element: HTMLElement) => {
      if (element.matches(sliderSelector)) {
        const length = Math.max(element.clientWidth, element.clientHeight)
        setThumbStrength(element, 'x', length)
        setThumbStrength(element, 'y', length)
        return
      }
      for (const [axis, viewport, content] of [
        ['x', element.clientWidth, element.scrollWidth],
        ['y', element.clientHeight, element.scrollHeight],
      ] as const) {
        const length = content > viewport ? Math.max(32, (viewport - 10) * viewport / content) : 320
        setThumbStrength(element, axis, length)
      }
      const height = element.clientHeight
      const overflow = element.matches(contentSelector) && desktop.matches && height >= 64 && element.scrollHeight > height + 1
        && /^(auto|scroll)$/.test(getComputedStyle(element).overflowY)
      element.toggleAttribute('data-scroll-overflow', overflow)
      if (!overflow) return
      const remaining = element.scrollHeight - height - element.scrollTop
      setValue(element, '--scroll-hint-end', `${remaining <= 1 ? 0 : Math.min(24, remaining)}px`)
      // 遮罩仅作用于正文，原生横纵滚动条和边框始终完整可见。
      setValue(element, '--scroll-hint-gutter-x', `${element.offsetWidth - element.clientWidth}px`)
      setValue(element, '--scroll-hint-gutter-y', `${element.offsetHeight - height}px`)
    }
    const schedule = (element: HTMLElement) => {
      if (!regions.has(element)) return
      pending.add(element)
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        for (const region of pending) measure(region)
        pending.clear()
      })
    }
    const resize = new ResizeObserver(entries => {
      for (const { target } of entries) {
        if (target instanceof HTMLElement) schedule(target)
        if (target.parentElement) schedule(target.parentElement)
      }
    })
    const syncChildren = (element: HTMLElement) => {
      const previous = regions.get(element)!
      const children = new Set(element.children)
      for (const child of previous) {
        if (!children.has(child) && !regions.has(child as HTMLElement) && !regions.has(child.parentElement!)) resize.unobserve(child)
      }
      for (const child of children) if (!previous.has(child)) resize.observe(child)
      regions.set(element, children)
    }
    const register = (element: HTMLElement) => {
      if (regions.has(element)) return
      regions.set(element, new Set())
      resize.observe(element)
      syncChildren(element)
      schedule(element)
    }
    const discover = (root: Element) => {
      if (root instanceof HTMLElement && root.matches(selector)) register(root)
      root.querySelectorAll<HTMLElement>(selector).forEach(register)
    }
    const clear = (element: HTMLElement) => {
      element.removeAttribute('data-scroll-overflow')
      for (const name of ['--scroll-hint-end', '--scroll-hint-gutter-x', '--scroll-hint-gutter-y', '--scroll-thumb-strength-x', '--scroll-thumb-strength-y']) element.style.removeProperty(name)
    }
    const mutations = new MutationObserver(records => {
      let removed = false
      for (const record of records) {
        for (const node of record.addedNodes) if (node instanceof Element) discover(node)
        removed ||= record.removedNodes.length > 0
        let parent = record.target instanceof Element ? record.target : record.target.parentElement
        while (parent) {
          const region = parent.closest<HTMLElement>(selector)
          if (!region) break
          if (regions.has(region)) {
            if (record.target === region && record.type === 'childList') syncChildren(region)
            schedule(region)
          }
          parent = region.parentElement
        }
      }
      if (removed) for (const [region, children] of regions) {
        if (region.isConnected) continue
        resize.unobserve(region)
        regions.delete(region)
        for (const child of children) if (!regions.has(child as HTMLElement) && !regions.has(child.parentElement!)) resize.unobserve(child)
        pending.delete(region)
        clear(region)
      }
    })
    const scroll = (event: Event) => {
      if (event.target instanceof HTMLElement) schedule(event.target)
    }
    const refresh = () => regions.forEach((_, region) => schedule(region))

    discover(document.body)
    mutations.observe(document.body, { childList: true, subtree: true, characterData: true })
    document.addEventListener('scroll', scroll, { capture: true, passive: true })
    document.addEventListener('input', scroll, { passive: true })
    desktop.addEventListener('change', refresh)
    return () => {
      mutations.disconnect()
      resize.disconnect()
      cancelAnimationFrame(frame)
      document.removeEventListener('scroll', scroll, true)
      document.removeEventListener('input', scroll)
      desktop.removeEventListener('change', refresh)
      regions.forEach((_, region) => clear(region))
    }
  }, [])
  return null
}

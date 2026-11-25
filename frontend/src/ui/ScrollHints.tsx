import { useEffect } from 'react'
import './scroll-hints.css'

// 只增强明确标记的原生滚动区，不插入容器、不接管滚轮或键盘。
export function ScrollHints() {
  useEffect(() => {
    const selector = '[data-scroll-hints], .scroll-hints'
    const regions = new Map<HTMLElement, Set<Element>>()
    const pending = new Set<HTMLElement>()
    const desktop = matchMedia('(min-width: 821px)')
    let frame = 0

    const setLength = (element: HTMLElement, name: string, value: number) => {
      const next = `${value}px`
      if (element.style.getPropertyValue(name) !== next) element.style.setProperty(name, next)
    }
    const measure = (element: HTMLElement) => {
      const height = element.clientHeight
      const overflow = desktop.matches && height >= 64 && element.scrollHeight > height + 1
        && /^(auto|scroll)$/.test(getComputedStyle(element).overflowY)
      element.toggleAttribute('data-scroll-overflow', overflow)
      if (!overflow) return
      const remaining = element.scrollHeight - height - element.scrollTop
      setLength(element, '--scroll-hint-end', remaining <= 1 ? 0 : Math.min(24, remaining))
      // 遮罩仅作用于正文，原生横纵滚动条和边框始终完整可见。
      setLength(element, '--scroll-hint-gutter-x', element.offsetWidth - element.clientWidth)
      setLength(element, '--scroll-hint-gutter-y', element.offsetHeight - height)
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
      for (const name of ['--scroll-hint-end', '--scroll-hint-gutter-x', '--scroll-hint-gutter-y']) element.style.removeProperty(name)
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
    desktop.addEventListener('change', refresh)
    return () => {
      mutations.disconnect()
      resize.disconnect()
      cancelAnimationFrame(frame)
      document.removeEventListener('scroll', scroll, true)
      desktop.removeEventListener('change', refresh)
      regions.forEach((_, region) => clear(region))
    }
  }, [])
  return null
}

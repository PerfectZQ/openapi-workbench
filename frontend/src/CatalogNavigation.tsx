import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowLeft, FileCode2, ChevronRight, ChevronsDownUp, ChevronsUpDown, Folder, FolderOpen, Layers, LocateFixed, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { catalogPath, modulePreview } from './catalog'
import { operationGroup, operationLifecycle, type APIGroup, type APIOperation } from './contract'

export function CatalogNavigation({ modules, routes, filtering, selected, moduleKey, onModule, onSelect, onClear }: {
  modules: APIGroup[]
  routes: APIOperation[]
  filtering: boolean
  selected?: APIOperation
  moduleKey: string
  onModule(key: string): void
  onSelect(api: APIOperation): void
  onClear(): void
}) {
  const { t } = useTranslation()
  const nav = useRef<HTMLElement>(null)
  const [expanded, setExpanded] = useState(new Set<string>())
  const activeModule = modules.find(group => group.key === moduleKey)
  const selectedPath = selected ? operationGroup(selected) : []
  const selectedModule = selectedPath.length ? '/' + selectedPath[0] : ''
  const selectedGroup = '/' + selectedPath.join('/')
  function locate() {
    if (!selected) return
    onClear()
    onModule(selectedModule)
    setExpanded(previous => new Set([...previous, ...selectedPath.map((_, i) => '/' + selectedPath.slice(0, i + 1).join('/'))]))
    requestAnimationFrame(() => nav.current?.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus())
  }
  useEffect(() => {
    if (!selected) return
    const parts = operationGroup(selected)
    setExpanded(previous => new Set([...previous, ...parts.map((_, i) => '/' + parts.slice(0, i + 1).join('/'))]))
    const frame = requestAnimationFrame(() => nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' }))
    return () => cancelAnimationFrame(frame)
  }, [selected])
  useEffect(() => { nav.current?.scrollTo(0, 0) }, [moduleKey, filtering])
  function browse(key: string) {
    onModule(key)
    requestAnimationFrame(() => {
      const target = key ? '.catalog-location > button' : `[data-module="${CSS.escape(moduleKey)}"]`
      nav.current?.closest('.api-catalog')?.querySelector<HTMLButtonElement>(target)?.focus({ preventScroll: true })
    })
  }
  function move(event: KeyboardEvent<HTMLElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    const index = buttons.indexOf(event.target as HTMLButtonElement)
    if (index < 0) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1)
    buttons[Math.max(0, Math.min(next, buttons.length - 1))]?.focus()
  }
  function operation(api: APIOperation) {
    const stage = operationLifecycle(api.operation)
    return <li key={api.key}>
      <button className="catalog-operation" type="button" aria-current={selected?.key === api.key ? 'page' : undefined}
        title={[api.operation.summary, api.method + ' ' + api.path, t('swagger.protocol.' + api.protocol)].join('\n')} onClick={() => onSelect(api)}>
        <FileCode2 size={14} aria-hidden="true" />
        <span className="catalog-operation-title">{api.operation.summary || api.action || api.path}</span>
        <span className={`catalog-method method-${api.method.toLowerCase()}`}>{api.method}</span>
        <code>{api.action || api.operation['x-api-action']?.name || api.operation.operationId || api.runtimePath}</code>
        {stage !== 'active' && <span className="api-lifecycle-badge">{t('swagger.lifecycle.' + stage)}</span>}
      </button>
    </li>
  }
  function contents(group: APIGroup) {
    return <>
      {group.children.length > 0 && <ul className="catalog-branches">{group.children.map(child => (
        <li key={child.key}>
          <button type="button" className="catalog-group-toggle" aria-expanded={expanded.has(child.key)}
            data-current={selectedGroup === child.key || selectedGroup.startsWith(child.key + '/') || undefined}
            onClick={() => setExpanded(previous => {
              const next = new Set(previous)
              if (next.has(child.key)) next.delete(child.key)
              else next.add(child.key)
              return next
            })}>
            <ChevronRight size={13} aria-hidden="true" />
            <strong>{child.label}</strong><span className="catalog-count">{child.count}</span>
          </button>
          {expanded.has(child.key) && <div className="catalog-children">{contents(child)}</div>}
        </li>
      ))}</ul>}
      {group.operations.length > 0 && <>
        {group.children.length > 0 && <p className="catalog-direct-title">{t('swagger.directEndpoints', { group: group.label })}</p>}
        <ul className="catalog-entries">{group.operations.map(operation)}</ul>
      </>}
    </>
  }
  const keys: string[] = []
  function collect(group: APIGroup) {
    for (const child of group.children) { keys.push(child.key); collect(child) }
  }
  if (activeModule) collect(activeModule)
  const results = new Map<string, APIOperation[]>()
  if (filtering) {
    for (const api of routes) {
      const key = catalogPath(api, modules).join(' / ')
      const group = results.get(key)
      if (group) group.push(api)
      else results.set(key, [api])
    }
  }
  return <>
    <div className="catalog-location">
      {!filtering && activeModule ?
        <button type="button" onClick={() => browse('')}><ArrowLeft size={14} />{t('swagger.allModules', { count: modules.length })}</button> :
        <span><Layers size={14} />{t(filtering ? 'swagger.searchResults' : 'swagger.allModules', { count: filtering ? routes.length : modules.length })}</span>}
      {selected && <button type="button" className="catalog-locate" aria-label={t('swagger.locateCurrent')} title={t('swagger.locateCurrent')} onClick={locate}><LocateFixed size={15} /></button>}
    </div>
    {!filtering && activeModule && <div className="catalog-module-heading">
      <FolderOpen size={16} /><h3>{activeModule.label}</h3><span className="catalog-count">{activeModule.count}</span>
      {keys.length > 0 && <div className="catalog-tree-actions">
        <button type="button" title={t('swagger.expandAll')} aria-label={t('swagger.expandAll')} disabled={keys.every(k => expanded.has(k))}
          onClick={() => setExpanded(previous => new Set([...previous, ...keys]))}><ChevronsUpDown size={15} /></button>
        <button type="button" title={t('swagger.collapseAll')} aria-label={t('swagger.collapseAll')} disabled={keys.every(k => !expanded.has(k))}
          onClick={() => setExpanded(previous => new Set([...previous].filter(key => !keys.includes(key))))}><ChevronsDownUp size={15} /></button>
      </div>}
    </div>}
    <nav ref={nav} className="catalog-groups" aria-label={t('swagger.catalog')} onKeyDown={move}>
      {filtering ? (results.size ? [...results].map(([path, apis]) => (
        <section className="catalog-result-group" key={path}>
          <h3><Folder size={13} />{path}</h3><ul className="catalog-entries">{apis.map(operation)}</ul>
        </section>
      )) : <div className="catalog-empty"><Search size={20} /><strong>{t('swagger.noMatches')}</strong>
        <p>{t('swagger.searchHint')}</p><button type="button" onClick={onClear}>{t('swagger.clearFilters')}</button></div>)
      : activeModule ? <div className="catalog-module-body">{contents(activeModule)}</div>
      : !modules.length ? <p className="catalog-empty">{t('swagger.emptyCatalog')}</p>
      : <ul className="catalog-modules">{modules.map(group => <li key={group.key}>
        <button type="button" className="catalog-module" data-module={group.key} title={modulePreview(group)} onClick={() => browse(group.key)}>
          <Folder size={16} aria-hidden="true" /><strong>{group.label}</strong><span className="catalog-count">{group.count}</span><ChevronRight size={13} />
        </button>
      </li>)}</ul>}
    </nav>
  </>
}

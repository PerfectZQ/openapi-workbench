import { useEffect, useMemo, useRef, useState } from 'react'
import { ListFilter, Search, X, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Select } from './ui/Select'
import { operationGroup, operationLifecycle, type APIGroup, type APIOperation } from './contract'
import { CatalogNavigation } from './CatalogNavigation'
import './api-catalog.css'

export function APICatalog({
  families, modules, moduleKey, onModule,
  selected,
  onSelect,
}: {
  families: Map<string, APIOperation[]>
  modules: APIGroup[]
  moduleKey: string
  onModule(key: string): void
  selected?: APIOperation
  onSelect(api?: APIOperation): void
}) {
  const { t } = useTranslation()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const catalog = useMemo(() => Array.from(families.values()).flat(), [families])
  const protocols = [...new Set(catalog.map((api) => api.protocol))]
  const [search, setSearch] = useState('')
  const [protocol, setProtocol] = useState('all')
  const [method, setMethod] = useState('all')
  const [lifecycle, setLifecycle] = useState('all')
  const filterCount = [protocol, method, lifecycle].filter((value) => value !== 'all').length
  const input = useRef<HTMLInputElement>(null)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        (!document.querySelector('dialog[open]') || input.current?.closest('dialog[open]')) &&
        input.current?.getClientRects().length
      ) {
        event.preventDefault()
        input.current.focus()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  const visible = useMemo(() => {
    const labels = new Map(modules.map(group => [group.key, group.label]))
    const words = search.trim().toLowerCase().split(/\s+/)
    return Array.from(families.values()).flatMap((routes) => {
      const matches = routes.filter((api) =>
        (protocol === 'all' || api.protocol === protocol) &&
        (method === 'all' || api.method === method) &&
        (lifecycle === 'all' || operationLifecycle(api.operation) === lifecycle) &&
        words.every((word) =>
          [api.operation.summary, api.operation.operationId, api.operation['x-api-action']?.name,
            labels.get('/' + operationGroup(api)[0]), api.action, api.actionVersion, api.method, api.path, ...(api.operation.tags ?? [])]
            .some(value => value?.toLowerCase().includes(word))),
      )
      const route = matches.find(api => api.key === selected?.key) ?? matches[0]
      return route ? [route] : []
    })
  }, [families, modules, search, method, protocol, lifecycle, selected])
  const filtering = !!search.trim() || filterCount > 0
  function clear() {
    setSearch('')
    setMethod('all')
    setProtocol('all')
    setLifecycle('all')
  }
  return (
    <div ref={container} className="api-catalog">
      <div className="catalog-top">
        <div className="catalog-label">
          <h2>{t('swagger.catalog')}</h2>
          <button type="button" className="catalog-overview" aria-current={!selected ? 'page' : undefined}
            onClick={() => { clear(); onSelect() }}><BookOpen size={14} />{t('swagger.overview')}</button>
        </div>
        <div className="catalog-search-row">
          <div className="catalog-search">
            <Search size={15} />
            <input
              ref={input}
              value={search}
              aria-label={t('swagger.searchAPI')}
              placeholder={t('swagger.searchAPI')}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={event => {
                if (event.nativeEvent.isComposing) return
                if (event.key === 'Escape') setSearch('')
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  container.current?.querySelector<HTMLButtonElement>('.catalog-groups button')?.focus()
                }
                if (event.key === 'Enter' && search.trim() && visible[0]) onSelect(visible[0])
              }}
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  input.current?.focus()
                }}
                aria-label={t('swagger.clear')}
              >
                <X size={14} />
              </button>
            ) : (
              <kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} K</kbd>
            )}
          </div>
          <button type="button" className="catalog-filter-toggle" aria-expanded={filtersOpen}
            aria-label={t('swagger.moreFilters', { count: filterCount })} title={t('swagger.moreFilters')}
            onClick={() => setFiltersOpen(!filtersOpen)}>
            <ListFilter size={16} aria-hidden="true" />{filterCount > 0 && <span>{filterCount}</span>}
          </button>
        </div>
        {filtersOpen && (
          <>
            <div className="catalog-filters">
              {protocols.length > 1 && (
                <Select
                  aria-label={t('swagger.protocol')}
                  value={protocol}
                  onValueChange={setProtocol}
                  showOptionDetails={false}
                >
                  <option value="all">{t('swagger.allProtocols')}</option>
                  {protocols.map((value) => (
                    <option key={value} value={value}>
                      {t('swagger.protocol.' + value)} · {Array.from(families.values()).filter(routes => routes.some(api => api.protocol === value)).length}
                    </option>
                  ))}
                </Select>
              )}
              <Select aria-label={t('swagger.method')} value={method} onValueChange={setMethod} showOptionDetails={false}>
                <option value="all">{t('swagger.method')}</option>
                {[...new Set(catalog.map((api) => api.method))].sort().map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </Select>
            </div>
            <div className="catalog-lifecycle-filter">
              <Select aria-label={t('swagger.lifecycle.filter')} value={lifecycle} onValueChange={setLifecycle} showOptionDetails={false}>
                <option value="all">{t('swagger.lifecycle.all')}</option>
                {(['active', 'deprecated', 'sunset'] as const).map((stage) => (
                  <option key={stage} value={stage}>
                    {t(`swagger.lifecycle.${stage}`)} · {Array.from(families.values()).filter(routes => routes.some(api => operationLifecycle(api.operation) === stage)).length}
                  </option>
                ))}
              </Select>
            </div>
            {filterCount > 0 && <button type="button" onClick={() => { setProtocol('all'); setMethod('all'); setLifecycle('all') }}>{t('swagger.clearFilters')}</button>}
          </>
        )}
      </div>
      <CatalogNavigation modules={modules} routes={visible} filtering={filtering} selected={selected}
        moduleKey={moduleKey} onModule={onModule} onSelect={onSelect} onClear={clear} />
      <footer className="catalog-footer">
        <span>{t('swagger.matchCount', { count: families.size })}</span>
        <span>OpenAPI 2.0</span>
      </footer>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Folder, Search, X, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Select } from './ui/Select'
import { catalogGroups, operationGroup, operationLifecycle, type APIGroup, type APIOperation } from './contract'
import './api-catalog.css'

export function APICatalog({
  catalog,
  selected,
  onSelect,
}: {
  catalog: APIOperation[]
  selected?: APIOperation
  onSelect(api?: APIOperation): void
}) {
  const { t } = useTranslation()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const protocols = [...new Set(catalog.map((api) => api.protocol))]
  const [search, setSearch] = useState('')
  const [protocol, setProtocol] = useState('all')
  const [method, setMethod] = useState('all')
  const [lifecycle, setLifecycle] = useState('all')
  const filterCount = [protocol, method, lifecycle].filter((value) => value !== 'all').length
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(catalogGroups(catalog).map((group) => group.key)))
  const [searchCollapsed, setSearchCollapsed] = useState<Set<string>>(() => new Set())
  const input = useRef<HTMLInputElement>(null)
  const navigation = useRef<HTMLElement>(null)
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        input.current?.getClientRects().length
      ) {
        event.preventDefault()
        input.current.focus()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  useEffect(() => {
    if (!selected) return
    const ancestors = operationGroup(selected).map((_, index, parts) => '/' + parts.slice(0, index + 1).join('/'))
    setExpanded((previous) => new Set([...previous, ...ancestors]))
    const frame = requestAnimationFrame(() => {
      navigation.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [selected])
  const visible = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/)
    return catalog.filter(
      (api) =>
        (protocol !== 'all' || !api.actionVersion) &&
        (protocol === 'all' || api.protocol === protocol) &&
        (method === 'all' || api.method === method) &&
        (lifecycle === 'all' || operationLifecycle(api.operation) === lifecycle) &&
        words.every((word) =>
          `${api.operation.summary} ${api.operation.operationId} ${api.operation['x-api-action']?.name ?? ''} ${api.action} ${api.path} ${api.operation.tags?.join(' ')}`
            .toLowerCase()
            .includes(word),
        ),
    )
  }, [catalog, search, method, protocol, lifecycle])
  const groups = useMemo(() => catalogGroups(visible), [visible])
  const groupKeys = useMemo(() => {
    const keys: string[] = []
    function collect(branches: APIGroup[]) {
      for (const group of branches) {
        keys.push(group.key)
        collect(group.children)
      }
    }
    collect(groups)
    return keys
  }, [groups])
  const searching = !!search.trim() || method !== 'all' || protocol !== 'all' || lifecycle !== 'all'
  function isSelected(api: APIOperation) {
    const id = api.operation['x-api-operation']
    return selected?.key === api.key || !!id && id === selected?.operation['x-api-operation']
  }
  const allExpanded = groupKeys.every((key) => searching ? !searchCollapsed.has(key) : expanded.has(key))
  const allCollapsed = groupKeys.every((key) => searching ? searchCollapsed.has(key) : !expanded.has(key))
  useEffect(() => setSearchCollapsed(new Set()), [search, method, protocol, lifecycle])
  const selectedGroup = selected ? '/' + operationGroup(selected).join('/') : ''
  function renderGroups(branches: APIGroup[], depth = 0) {
    return branches.map((group) => {
      const open = searching ? !searchCollapsed.has(group.key) : expanded.has(group.key)
      const currentBranch = selectedGroup === group.key || selectedGroup.startsWith(group.key + '/')
      return (
        <li className="catalog-group" data-depth={depth} key={group.key}>
          <button
            type="button"
            className={`catalog-group-toggle ${currentBranch ? 'is-current-branch' : ''}`}
            aria-expanded={open}
            title={group.key}
            onClick={() => (searching ? setSearchCollapsed : setExpanded)((previous) => {
              const next = new Set(previous)
              if (next.has(group.key)) next.delete(group.key)
              else next.add(group.key)
              return next
            })}
          >
            {depth === 0 && <Folder size={15} aria-hidden="true" />}
            <strong>{group.label}</strong>
            <span className="catalog-count">{group.count}</span>
            <ChevronDown size={13} className={`catalog-chevron ${open ? '' : 'collapsed'}`} aria-hidden="true" />
          </button>
          {open && <>
            {group.children.length > 0 && <ul className="catalog-branches">{renderGroups(group.children, depth + 1)}</ul>}
            {group.operations.length > 0 && <div className="catalog-entries">
              {group.operations.map((api) => (
                <button key={api.key} type="button"
                  className={`catalog-operation protocol-${api.protocol} ${isSelected(api) ? 'is-selected' : ''}`}
                  aria-current={isSelected(api) ? 'page' : undefined}
                  onClick={() => onSelect(api)} title={`${api.operation.summary}\n${api.path}`}>
                  <span className="catalog-operation-label">
                    <span>{api.operation.summary || api.action || api.path}</span>
                    <code>{api.action || api.operation['x-api-action']?.name || api.operation.operationId || api.runtimePath}</code>
                    {operationLifecycle(api.operation) !== 'active' && (
                      <span className="api-lifecycle-badge">{t(`swagger.lifecycle.${operationLifecycle(api.operation)}`)}</span>
                    )}
                  </span>
                  <span className="catalog-operation-kind">
                    <span className={`catalog-method method-${api.method.toLowerCase()}`}>{api.method}</span>
                    {protocols.length > 1 && <span className={`protocol-label protocol-${api.protocol}`}>{t(`swagger.protocol.${api.protocol}`)}</span>}
                  </span>
                </button>
              ))}
            </div>}
          </>}
        </li>
      )
    })
  }
  return (
    <div className="api-catalog">
      <div className="catalog-top">
        <button
          type="button"
          className="catalog-overview"
          aria-current={!selected ? 'page' : undefined}
          onClick={() => onSelect()}
        >
          <BookOpen size={16} />
          {t('swagger.overview')}
        </button>
        <div className="catalog-label">
          <h2>{t('swagger.catalog')}</h2>
          <span>{catalog.filter((api) => !api.actionVersion).length}</span>
        </div>
        <div className="catalog-search">
          <Search size={15} />
          <input
            ref={input}
            value={search}
            aria-label={t('swagger.searchAPI')}
            placeholder={t('swagger.searchAPI')}
            onChange={(event) => setSearch(event.target.value)}
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
        <button type="button" className="catalog-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
          {t('swagger.moreFilters')}{filterCount > 0 && <span>{filterCount}</span>}<ChevronDown size={14} />
        </button>
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
                      {t('swagger.protocol.' + value)} · {catalog.filter((api) => api.protocol === value).length}
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
                    {t(`swagger.lifecycle.${stage}`)} · {catalog.filter((api) => !api.actionVersion && operationLifecycle(api.operation) === stage).length}
                  </option>
                ))}
              </Select>
            </div>
            {filterCount > 0 && <button type="button" onClick={() => { setProtocol('all'); setMethod('all'); setLifecycle('all') }}>{t('swagger.clearFilters')}</button>}
          </>
        )}
        <div className="catalog-tree-actions" role="group" aria-label={t('swagger.catalog')}>
          <button type="button" aria-disabled={allExpanded}
            onClick={() => {
              if (allExpanded) return
              if (searching) setSearchCollapsed(new Set())
              else setExpanded(new Set(groupKeys))
            }}>
            <ChevronsUpDown size={14} aria-hidden="true" />
            {t('swagger.expandAll')}
          </button>
          <button type="button" aria-disabled={allCollapsed}
            onClick={() => {
              if (allCollapsed) return
              if (searching) setSearchCollapsed(new Set(groupKeys))
              else setExpanded(new Set())
            }}>
            <ChevronsDownUp size={14} aria-hidden="true" />
            {t('swagger.collapseAll')}
          </button>
        </div>
      </div>
      <nav ref={navigation} className="catalog-groups" aria-label={t('swagger.catalog')}>
        <ul className="catalog-tree">{renderGroups(groups)}</ul>
        {!visible.length && (
          <div className="catalog-empty">
            <Search size={22} />
            <strong>{t('swagger.noMatches')}</strong>
            <p>{t('swagger.searchHint')}</p>
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setMethod('all')
                setProtocol('all')
                setLifecycle('all')
              }}
            >
              {t('swagger.clearFilters')}
            </button>
          </div>
        )}
      </nav>
      <footer className="catalog-footer">
        <span>{t('swagger.matchCount', { count: visible.length })}</span>
        <span>OpenAPI 2.0</span>
      </footer>
    </div>
  )
}

import { useRef } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { APIGroup, APIOperation, Specification } from './contract'
import { modulePreview } from './catalog'
import { CopyButton } from './ui/CopyButton'

export function APIOverview({ spec, modules, moduleKey, onModule, onSelect }: {
  spec: Specification
  modules: APIGroup[]
  moduleKey: string
  onModule(key: string): void
  onSelect(api: APIOperation): void
}) {
  const { t } = useTranslation()
  const view = useRef<HTMLElement>(null)
  const active = modules.find(group => group.key === moduleKey)
  function browse(key: string) {
    onModule(key)
    view.current?.scrollTo(0, 0)
    requestAnimationFrame(() => view.current?.querySelector('h1')?.focus({ preventScroll: true }))
  }
  function sections(group: APIGroup, path: string): React.ReactNode {
    return <section className="overview-category" key={group.key}>
      {group.operations.length > 0 && <>
        <h3>{path}<span className="catalog-count">{group.operations.length}</span></h3>
        <ul>{group.operations.map(api => <li key={api.key}>
          <button type="button" onClick={() => onSelect(api)}>
            <span className={`catalog-method method-${api.method.toLowerCase()}`}>{api.method}</span>
            <span>{api.operation.summary || api.action || api.path}</span>
            <code>{api.action || api.runtimePath}</code>
          </button>
        </li>)}</ul>
      </>}
      {group.children.map(child => sections(child, path + ' / ' + child.label))}
    </section>
  }
  return <article ref={view} className="api-overview">
    <div className="overview-content">
      {active ? <>
        <button className="overview-back" type="button" onClick={() => browse('')}><ArrowLeft size={14} />{t('swagger.allModules', { count: modules.length })}</button>
        <h1 tabIndex={-1}>{active.label}</h1>
        <p className="api-muted">{t('swagger.matchCount', { count: active.count })}</p>
        {sections(active, active.label)}
      </> : <>
        <header>
          <h1 tabIndex={-1}>{spec.info.title}</h1>
          <div className="overview-meta">
            {spec.info.version && <span>v{spec.info.version}</span>}
            <span>OpenAPI {spec.swagger}</span>
            <span>{t('swagger.matchCount', { count: modules.reduce((total, group) => total + group.count, 0) })}</span>
          </div>
          {spec.info.description && <p className="overview-description">{spec.info.description}</p>}
        </header>
        <div className="overview-server">
          <span>{t('swagger.server')}</span>
          <code>{window.location.origin}{spec.basePath ?? '/'}</code>
          <CopyButton value={window.location.origin + (spec.basePath ?? '/')} />
        </div>
        {modules.length ? <section>
          <h2>{t('swagger.allModules', { count: modules.length })}</h2>
          <div className="overview-modules">{modules.map(group =>
            <button type="button" key={group.key} onClick={() => browse(group.key)}>
              <strong>{group.label}</strong><span className="catalog-count">{t('swagger.matchCount', { count: group.count })}</span><ChevronRight size={14} />
              <small><code>{group.key.slice(1)}</code>{modulePreview(group)}</small>
            </button>
          )}</div>
        </section> : <p className="api-muted">{t('swagger.emptyCatalog')}</p>}
      </>}
    </div>
  </article>
}

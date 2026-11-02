import { ArrowRight, Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { HelpTip } from '@workbench/ui/HelpTip'
import { formatGroupLabel, operationGroup, type APIOperation, type Specification } from './contract'
import { CopyButton } from '@workbench/ui/CopyButton'

export function APIOverview({
  spec,
  catalog,
  onSelect,
}: {
  spec: Specification
  catalog: APIOperation[]
  onSelect(api: APIOperation): void
}) {
  const { t } = useTranslation()
  const groups = new Map<string, APIOperation[]>()
  for (const api of catalog) {
    const name = '/' + operationGroup(api).slice(0, 2).join('/')
    groups.set(name, [...(groups.get(name) ?? []), api])
  }
  return (
    <article className="api-overview">
      <div className="overview-content">
        <header>
          <p className="api-breadcrumb">{t('swagger.overview')}</p>
          <div className="heading-with-help">
            <h1 tabIndex={-1}>{spec.info.title}</h1>
            <HelpTip label={t('swagger.overview')} description={t('swagger.overviewHint')} />
          </div>
          <div className="overview-meta">
            <span>v{spec.info.version}</span>
            <span>OpenAPI {spec.swagger}</span>
            <span>{t('swagger.matchCount', { count: catalog.length })}</span>
          </div>
          {spec.info.description && <p className="overview-description">{spec.info.description}</p>}
        </header>
        <section className="overview-start">
          <h2>{t('swagger.getStarted')}</h2>
          <p>{t('swagger.getStartedHint')}</p>
          {catalog[0] && <button type="button" className="primary-button" onClick={() => onSelect(catalog[0])}>
            {t('swagger.browseFirst')}<ArrowRight size={15} />
          </button>}
        </section>
        <div className="overview-server">
          <span>{t('swagger.server')}</span>
          <code>
            {window.location.origin}
            {spec.basePath}
          </code>
          <CopyButton value={`${window.location.origin}${spec.basePath ?? '/'}`} />
        </div>
        <section>
          <div className="section-heading">
            <div className="heading-with-help">
              <h2>{t('swagger.groups')}</h2>
              <HelpTip label={t('swagger.groups')} description={t('swagger.browseGroup')} />
            </div>
          </div>
          <div className="overview-groups">
            {[...groups].map(([name, apis]) => (
              <button key={name} type="button" onClick={() => onSelect(apis[0])}>
                <Folder size={17} strokeWidth={1.6} />
                <strong>{name.split('/').map(formatGroupLabel).join('/')}</strong>
                <span className="overview-methods">
                  {[...new Set(apis.map((api) => api.method))].map((method) => (
                    <span key={method} className={`catalog-method method-${method.toLowerCase()}`}>
                      {method}
                    </span>
                  ))}
                </span>
                <span className="overview-group-count">{apis.length}</span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </section>
      </div>
    </article>
  )
}

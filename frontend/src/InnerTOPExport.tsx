import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HelpTip } from '@workbench/ui/HelpTip'
import { CircleAlert, Download, X } from 'lucide-react'
import { actionIdentity, operations, type APIOperation, type Specification } from './contract'
import {
  ExportError,
  generateInnerTOP,
  innerTOPExportIssue,
  type ExportOptions,
  type ExportRoute,
} from './innertop'

export function InnerTOPExport({
  spec,
  operation,
  defaults,
  onClose,
  onDownload,
}: {
  spec: Specification
  operation?: APIOperation
  defaults: ExportOptions
  onClose(): void
  onDownload(data: Blob, name: string): void
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<string[]>([])
  const exportKeys = useMemo(() => operation ? [operation.key] : selected, [operation, selected])
  const [config, setConfig] = useState<ExportOptions>(() => ({
    ...defaults,
    version: operation ? actionIdentity(operation)?.version ?? defaults.version : defaults.version,
  }))
  const [routes, setRoutes] = useState(JSON.stringify(defaults.routes, null, 2))
  const [search, setSearch] = useState('')
  const [onlyReady, setOnlyReady] = useState(false)
  const catalog = useMemo(() => operation ? [operation] : operations(spec).filter((item) => item.protocol === 'innertop'), [spec, operation])
  const issues = useMemo(
    () => new Map(catalog.map((item) => [item.key, innerTOPExportIssue(spec, item.key, { ...defaults, version: config.version })])),
    [catalog, spec, defaults, config.version],
  )
  const operationIssue = operation && issues.get(operation.key)
  const blocked = operationIssue && operationIssue.code !== 'version'
  const readyCount = [...issues.values()].filter((issue) => !issue).length
  function issueText(key: string) {
    const issue = issues.get(key)
    return issue ? t(`swagger.exportError.${issue.code}`, { detail: issue.detail }) : ''
  }
  const visible = catalog.filter(
    (item) =>
      (!onlyReady || !issues.get(item.key)) &&
      `${item.action} ${item.operation.summary}`.toLowerCase().includes(search.toLowerCase()),
  )
  function downloadLimitations() {
    const limitations = catalog
      .filter((item) => issues.get(item.key))
      .map((item) => ({
        Action: item.action,
        Path: item.runtimePath,
        Limitation: issueText(item.key),
        Resolution: t(`swagger.exportRemedy.${issues.get(item.key)!.code}`, { detail: issues.get(item.key)!.detail }),
      }))
    onDownload(
      new Blob([JSON.stringify(limitations, null, 2) + '\n'], { type: 'application/json' }),
      'innertop-export-limitations.json',
    )
  }
  const preview = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(routes)
      if (!Array.isArray(parsed) || parsed.some((route) => !route || typeof route !== 'object'))
        throw new ExportError('routes')
      const result = generateInnerTOP(spec, exportKeys, { ...config, routes: parsed as ExportRoute[] })
      return { json: JSON.stringify(result, null, 2), error: '' }
    } catch (cause) {
      return {
        json: '',
        error:
          cause instanceof ExportError
            ? t(`swagger.exportError.${cause.code}`, { detail: cause.detail })
            : t(cause instanceof SyntaxError ? 'swagger.exportError.routes' : 'swagger.exportError.schema'),
      }
    }
  }, [spec, exportKeys, config, routes, t])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = dialog.current!
    element.showModal()
    element.querySelector<HTMLElement>('h2')?.focus()
    return () => {
      element.close()
      previous?.focus()
    }
  }, [])
  function change<K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) {
    setConfig((previous) => ({ ...previous, [key]: value }))
  }
  return (
    <dialog
      ref={dialog}
      className={`innertop-dialog${operation ? ' innertop-single' : ''}`}
      aria-labelledby="innertop-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <header>
        <div className="heading-with-help">
          <h2 id="innertop-title" tabIndex={-1}>{t(operation ? 'swagger.exportCurrent' : 'swagger.exportAll')}</h2>
          <HelpTip label={t('swagger.export')} description={t('swagger.exportHint')} />
        </div>
        <button className="api-icon" onClick={onClose} type="button" aria-label={t('swagger.close')}>
          <X size={20} />
        </button>
      </header>
      <div className="innertop-body">
        {operation ? (
          <section className="innertop-current" aria-label={t('swagger.currentOperation')}>
            <h3>{operation.operation.summary || operation.action}</h3>
            <code>{operation.method} {operation.runtimePath}?Action={operation.action}</code>
            {blocked && (
              <div className="innertop-blocked" role="status">
                <h3><CircleAlert size={18} aria-hidden="true" />{t('swagger.exportBlocked')}</h3>
                <p>{issueText(operation.key)}</p>
                <h4>{t('swagger.exportResolution')}</h4>
                <p>{t(`swagger.exportRemedy.${operationIssue.code}`, { detail: operationIssue.detail })}</p>
              </div>
            )}
          </section>
        ) : (
          <section className="innertop-operations" aria-label={t('swagger.selectOperations')}>
            <label className="api-field">
              {t('swagger.selectOperations')}
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('swagger.search')}
              />
            </label>
            <div className="innertop-availability">
              <p>
                {t('swagger.exportAvailability', {
                  ready: readyCount,
                  total: catalog.length,
                  blocked: catalog.length - readyCount,
                })}
              </p>
              <label>
                <input type="checkbox" checked={onlyReady} onChange={(event) => setOnlyReady(event.target.checked)} />
                {t('swagger.exportOnlyReady')}
              </label>
              <button type="button" onClick={downloadLimitations}>
                {t('swagger.exportLimitations')}
              </button>
            </div>
            <div className="innertop-selection">
              <span>{t('swagger.selected', { count: selected.length })}</span>
              <button
                type="button"
                onClick={() =>
                  setSelected([
                    ...new Set([...selected, ...visible.filter((item) => !issues.get(item.key)).map((item) => item.key)]),
                  ])
                }
              >
                {t('swagger.selectVisible')}
              </button>
              <button type="button" onClick={() => setSelected([])}>
                {t('swagger.clear')}
              </button>
            </div>
            <div className="innertop-list">
              {visible.map((item) => (
                <label key={item.key} className={`innertop-operation ${issues.get(item.key) ? 'has-limitation' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected.includes(item.key)}
                    disabled={!!issues.get(item.key)}
                    onChange={(event) =>
                      setSelected((previous) =>
                        event.target.checked ? [...previous, item.key] : previous.filter((key) => key !== item.key),
                      )
                    }
                  />
                  <span>
                    <strong>{item.operation.summary}</strong>
                    <code>{item.action}</code>
                    {issues.get(item.key) && <>
                      <small>{issueText(item.key)}</small>
                      <small>{t('swagger.exportResolution')}：{t(`swagger.exportRemedy.${issues.get(item.key)!.code}`, { detail: issues.get(item.key)!.detail })}</small>
                    </>}
                  </span>
                </label>
              ))}
              {!visible.length && <p>{t('swagger.noMatches')}</p>}
            </div>
          </section>
        )}
        {!blocked && (
          <section className="innertop-settings" aria-label={t('swagger.exportSettings')}>
            <div className="api-field-pair">
              <label className="api-field">
                ServiceCode
                <input value={config.serviceCode} onChange={(event) => change('serviceCode', event.target.value)} />
              </label>
              <label className="api-field">
                Version
                <input value={config.version} onChange={(event) => change('version', event.target.value)} />
              </label>
              <label className="api-field">
                {t('swagger.group')}
                <input value={config.group} onChange={(event) => change('group', event.target.value)} />
              </label>
              <label className="api-field">
                {t('swagger.groupDescription')}
                <input
                  value={config.groupDescription}
                  onChange={(event) => change('groupDescription', event.target.value)}
                />
              </label>
              <label className="api-field">
                {t('swagger.qps')}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={config.qps}
                  onChange={(event) => change('qps', Number(event.target.value))}
                />
              </label>
              <label className="api-field">
                {t('swagger.timeout')}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={config.timeout}
                  onChange={(event) => change('timeout', Number(event.target.value))}
                />
              </label>
            </div>
            <label className="api-field">
              {t('swagger.allowList')}
              <input
                value={config.allowList.join(', ')}
                onChange={(event) =>
                  change(
                    'allowList',
                    event.target.value.split(',').map((value) => value.trim()),
                  )
                }
              />
            </label>
            <details>
              <summary>{t('swagger.routes')}</summary>
              <div className="heading-with-help">
                <label htmlFor="innertop-routes">{t('swagger.routes')}</label>
                <HelpTip label={t('swagger.routes')} description={t('swagger.routesHint')} />
              </div>
              <div className="api-field">
                <textarea
                  id="innertop-routes"
                  rows={12}
                  spellCheck={false}
                  value={routes}
                  onChange={(event) => setRoutes(event.target.value)}
                />
              </div>
            </details>
            <details>
              <summary>{t('swagger.preview')}</summary>
              <pre tabIndex={0}>{preview.json || preview.error}</pre>
            </details>
          </section>
        )}
      </div>
      <footer>
        {blocked ? (
          <button type="button" onClick={onClose}>{t('swagger.close')}</button>
        ) : (
          <>
            <p id="innertop-export-status" role="status">{preview.error || t('swagger.ready', { count: exportKeys.length })}</p>
            <button
              type="button"
              className="primary-button"
              disabled={!preview.json}
              aria-describedby="innertop-export-status"
              onClick={() =>
                onDownload(
                  new Blob([preview.json + '\n'], { type: 'application/json' }),
                  `innertop-${config.serviceCode}-${config.version}.json`,
                )
              }
            >
              <Download size={16} />
              {t('swagger.downloadJSON')}
            </button>
          </>
        )}
      </footer>
    </dialog>
  )
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { I18nextProvider, useTranslation } from 'react-i18next'
import i18next from 'i18next'
import { uiTranslations } from './ui/locales'
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'
import { Download, RefreshCw, FileJson, Menu, X, Braces, ChevronDown, KeyRound } from 'lucide-react'
import { ActionMenu } from './ui/ActionMenu'
import { RequestSettingsDialog } from './RequestSettingsDialog'
import { emptySettings } from './settings'
import { APIOverview } from './APIOverview'
import { download } from './download'
import { APICatalog } from './APICatalog'
import { CatalogResizeHandle } from './CatalogResizeHandle'
import type { RequestSession } from './RequestConsole'
import { OperationDetail } from './OperationDetail'
import { InnerTOPExport } from './InnerTOPExport'
import { catalogGroups, operationGroup, operations, type APIOperation, type Specification } from './contract'
import type { APIWorkbenchHost } from './host'

export type Locale = 'zh-CN' | 'en-US'
export interface APIWorkbenchProps { host: APIWorkbenchHost; locale?: Locale; headerActions?: ReactNode }

export function APIWorkbench({ locale = 'zh-CN', ...props }: APIWorkbenchProps) {
  const [language] = useState(() => {
    const instance = i18next.createInstance()
    void instance.init({
      lng: locale, fallbackLng: 'zh-CN', keySeparator: false, initAsync: false,
      interpolation: { escapeValue: false },
      resources: {
        'zh-CN': { translation: { ...uiTranslations['zh-CN'], ...zhCN } },
        'en-US': { translation: { ...uiTranslations['en-US'], ...enUS } },
      },
    })
    return instance
  })
  useEffect(() => { void language.changeLanguage(locale) }, [language, locale])
  return <I18nextProvider i18n={language}><Workbench {...props} /></I18nextProvider>
}

function Workbench({ host, headerActions }: APIWorkbenchProps) {
  const { t, i18n: language } = useTranslation()
  const [settings, setSettings] = useState(emptySettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [spec, setSpec] = useState<Specification>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [exporting, setExporting] = useState<APIOperation | 'all' | null>(null)
  const [selection, setSelection] = useState(() => window.location.hash.slice(1))
  const [menuOpen, setMenuOpen] = useState(false)
  const menu = useRef<HTMLDialogElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const catalog = useMemo(() => (spec ? operations(spec) : []), [spec])
  // A catalog entry may expose multiple wire routes. Only the contract can link them.
  const families = useMemo(() => {
    const groups = new Map<string, APIOperation[]>()
    for (const api of catalog) {
      const id = api.operation['x-api-operation'] || api.key
      const routes = groups.get(id)
      if (routes) routes.push(api)
      else groups.set(id, [api])
    }
    return groups
  }, [catalog])
  const selected = catalog.find((api) => encodeURIComponent(api.key) === selection)
  const modules = useMemo(() => {
    const entries = Array.from(families.values(), routes => selected && routes.includes(selected) ? selected : routes[0])
    const groups = catalogGroups(entries)
    for (const group of groups) group.label = host.moduleLabel?.(group.key.slice(1)) || group.label
    return groups.sort((a, b) => a.label.localeCompare(b.label, language.language))
  }, [families, selected, host, language.language])
  const [moduleKey, setModuleKey] = useState('')
  const sessions = useMemo(() => new Map<string, RequestSession>(), [spec])
  useEffect(() => { setModuleKey(selected ? '/' + operationGroup(selected)[0] : '') }, [selected])
  useEffect(() => {
    const change = () => setSelection(window.location.hash.slice(1))
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [])
  useEffect(() => {
    if (!menuOpen) return
    const element = menu.current!
    element.showModal()
    return () => {
      element.close()
      menuButton.current?.focus()
    }
  }, [menuOpen])
  function select(api?: APIOperation, focusProtocol = false) {
    const hash = api ? encodeURIComponent(api.key) : ''
    setModuleKey(api ? '/' + operationGroup(api)[0] : '')
    window.location.hash = hash
    setSelection(hash)
    setMenuOpen(false)
    document.querySelector('.operation-workspace')?.scrollTo(0, 0)
    requestAnimationFrame(() => {
      const target = focusProtocol ? '.operation-protocols [aria-pressed="true"]' : '.api-layout h1'
      document.querySelector<HTMLElement>(target)?.focus({ preventScroll: true })
    })
  }
  const [downloading, setDownloading] = useState(false)
  const [failedSDK, setFailedSDK] = useState<'go' | 'typescript'>()
  useEffect(() => {
    document.title = spec ? `${spec.info.title} · API Explorer` : 'API Explorer'
  }, [spec, language.language])
  useEffect(() => {
    let active = true
    setError('')
    host.loadSpecification()
      .then((value) => {
        if (active) setSpec(value)
      })
      .catch((cause) => {
        if (active) setError(cause.message)
      })
    return () => {
      active = false
    }
  }, [attempt, host])
  async function sdk(language: 'go' | 'typescript') {
    if (!host.loadSDK) return
    setDownloading(true)
    setFailedSDK(undefined)
    setError('')
    try {
      download(await host.loadSDK(language), language === 'typescript' ? 'sdk-typescript.zip' : 'sdk.zip')
    } catch (cause) {
      setFailedSDK(language)
      setError((cause as Error).message)
    } finally {
      setDownloading(false)
    }
  }
  return (
    <main className="swagger-workbench">
      <header className="api-header">
        <div className="api-brand">
          <button
            ref={menuButton}
            type="button"
            className="catalog-menu"
            onClick={() => setMenuOpen(true)}
            aria-label={t('swagger.catalog')}
            disabled={!spec}
          >
            <Menu size={20} />
          </button>
          <Braces size={23} strokeWidth={1.7} aria-hidden="true" />
          <strong>API Explorer</strong>
          {spec && (
            <span className="api-service-name" title={spec.info.title}>
              {spec.info.title}
            </span>
          )}
        </div>
        <div className="api-header-actions">
          <button
            type="button"
            className="settings-trigger"
            disabled={!spec}
            onClick={() => setSettingsOpen(true)}
            aria-label={t('swagger.settingsTitle')}
            title={t('swagger.settingsTitle')}
          >
            <KeyRound size={16} />
            <span>{t('swagger.settingsTitle')}</span>
          </button>
          <ActionMenu
            label={t(downloading ? 'swagger.downloading' : 'swagger.exportMenu')}
            icon={<ChevronDown size={14} />}
            triggerClassName="api-export-trigger"
            disabled={!spec || downloading}
          >
            <button
              type="button"
              onClick={() =>
                spec &&
                download(new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' }), 'openapi.json')
              }
            >
              <FileJson size={16} />
              OpenAPI JSON
            </button>
            {host.loadSDK && (<>
              <button type="button" onClick={() => sdk('go')}>
                <Download size={16} />
                {t('swagger.sdk')}
              </button>
              <button type="button" onClick={() => sdk('typescript')}><Download size={16} />{t('swagger.sdkTypeScript')}</button>
            </>)}
            {host.innerTOP && (
              <button type="button" onClick={() => setExporting('all')} disabled={!catalog.some((api) => api.protocol === 'innertop')}>
                <FileJson size={16} />
                {t('swagger.exportAll')}
              </button>
            )}
          </ActionMenu>
          {headerActions}
        </div>
      </header>
      {error && (
        <div className="api-feedback" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => failedSDK ? void sdk(failedSDK) : setAttempt((value) => value + 1)}>
            <RefreshCw size={16} />
            {t('swagger.retry')}
          </button>
        </div>
      )}
      {spec ? (
        <div className="api-layout">
          <aside id="api-sidebar" className="api-sidebar">
            <APICatalog families={families} modules={modules} moduleKey={moduleKey} onModule={setModuleKey} selected={selected} onSelect={select} />
            <CatalogResizeHandle />
          </aside>
          <div className="api-content">
            {selected ? (
              <OperationDetail
                key={selected.key}
                spec={spec}
                api={selected}
                sessions={sessions}
                settings={settings}
                onSettings={() => setSettingsOpen(true)}
                onExport={host.innerTOP ? () => setExporting(selected) : undefined}
                requestAdapter={host.request}
                modules={modules}
                protocols={families.get(selected.operation['x-api-operation'] || selected.key)!}
                onProtocol={api => select(api, true)}
              />
            ) : (
              <APIOverview spec={spec} modules={modules} moduleKey={moduleKey} onModule={setModuleKey} onSelect={select} />
            )}
          </div>
        </div>
      ) : (
        !error && (
          <div className="api-loading" role="status">
            <div className="api-loading-sidebar" />
            <div>
              <span className="api-loading-line" />
              <h1>{t('swagger.loading')}</h1>
              <p>{t('swagger.loadingHint')}</p>
            </div>
          </div>
        )
      )}
      {menuOpen && spec && (
        <dialog
          ref={menu}
          className="catalog-dialog"
          aria-label={t('swagger.catalog')}
          onCancel={(event) => {
            event.preventDefault()
            setMenuOpen(false)
            menuButton.current?.focus()
          }}
        >
          <header>
            <strong>{t('swagger.catalog')}</strong>
            <button
              type="button"
              aria-label={t('swagger.close')}
              onClick={() => {
                setMenuOpen(false)
                menuButton.current?.focus()
              }}
            >
              <X size={18} />
            </button>
          </header>
          <APICatalog families={families} modules={modules} moduleKey={moduleKey} onModule={setModuleKey} selected={selected} onSelect={select} />
        </dialog>
      )}
      {spec && settingsOpen && (
        <RequestSettingsDialog
          spec={spec}
          settings={settings}
          authentication={host.request?.authentication}
          onSave={setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {spec && exporting && host.innerTOP && (
        <InnerTOPExport
          spec={spec}
          defaults={host.innerTOP}
          operation={exporting === 'all' ? undefined : exporting}
          onClose={() => {
            setExporting(null)
          }}
          onDownload={download}
        />
      )}
    </main>
  )
}

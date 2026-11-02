import { useEffect, useRef, useState } from 'react'
import { CircleAlert, ArrowUpRight, RotateCcw, ShieldCheck, Square, Terminal, Download, Trash2, WrapText, CornerDownLeft, Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { HelpTip } from '@workbench/ui/HelpTip'
import { Select } from '@workbench/ui/Select'
import type { RequestAdapter } from './host'
import { actionIdentity, type APIOperation, type Specification } from './contract'
import {
  type RequestDraft,
  initialDraft,
  effectiveDraft,
  prepareRequest,
  RequestError,
  requestCurl,
  requestParameters,
  requestURL,
  supportsAutomaticAuth,
  automaticRequestHeaders,
} from './request'
import { CopyButton } from '@workbench/ui/CopyButton'
import { CodeBlock } from './CodeBlock'
import { RequestFields } from './RequestFields'
import { RequestBodyEditor } from './RequestBodyEditor'
import type { RequestSettings } from './settings'
import { download } from './download'
import { authorizationTypes } from './authorization'
import { AuthorizationBadge } from './AuthorizationBadge'
import { CredentialFields } from './CredentialFields'

interface ResponseResult {
  status: number
  statusText: string
  duration: number
  size: number
  body: string
  headers: string
}

export interface RequestSession {
  draft: RequestDraft
  result?: ResponseResult
  error: string
  notice: string
  tab: string
  responseTab: string
}

export function RequestConsole({
  spec,
  api,
  settings,
  onSettings,
  adapter,
  sessions,
}: {
  sessions: Map<string, RequestSession>
  spec: Specification
  api: APIOperation
  adapter?: RequestAdapter
  settings: RequestSettings
  onSettings(): void
}) {
  const { t } = useTranslation()
  const authenticationProvider = adapter?.authentication
  const saved = sessions.get(api.key)
  const [draft, setDraft] = useState(() => saved?.draft ?? initialDraft(spec, api, adapter))
  const hasBody = api.operation.parameters?.some((parameter) => parameter.in === 'body')
  const [tab, setTab] = useState(saved?.tab ?? (hasBody ? 'body' : 'parameters'))
  const [responseTab, setResponseTab] = useState(saved?.responseTab ?? 'body')
  const [result, setResult] = useState<ResponseResult | undefined>(saved?.result)
  const [error, setError] = useState(saved?.error ?? '')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState(saved?.notice ?? '')
  const [showCurl, setShowCurl] = useState(false)
  const [wrap, setWrap] = useState(false)
  useEffect(() => {
    sessions.set(api.key, { draft, result, error, notice, tab, responseTab })
  }, [sessions, api.key, draft, result, error, notice, tab, responseTab])
  const responseView = useRef<HTMLElement>(null)
  const revealResponse = useRef(false)
  useEffect(() => {
    if (result && revealResponse.current) {
      revealResponse.current = false
      responseView.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    }
  }, [result])
  const request = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      request.current?.abort()
      request.current = null
    },
    [],
  )
  const identity = actionIdentity(api)
  const inherited = effectiveDraft(spec, api, { ...draft, values: {} }, settings, adapter)
  const effective = effectiveDraft(spec, api, draft, settings, adapter)
  const automatic = automaticRequestHeaders(spec, api, effective, adapter)
  const sharedHeaders = settings.headers.filter((header) => header.enabled)
  const parameters = requestParameters(spec, api)
  const authentication = parameters.filter((parameter) => parameter.authentication)
  const authTypes = authorizationTypes(spec, settings.customAuthorizations)
  const selectedAuth = authTypes.find((type) => type.id === draft.authorization?.type)
  const editable = parameters.filter((parameter) =>
    tab === 'auth'
      ? parameter.authentication && parameter.format !== 'basic'
      : !parameter.authentication &&
        (parameter.in === (tab === 'headers' ? 'header' : 'query') ||
          (tab === 'parameters' && parameter.in === 'path')),
  )
  let curl = ''
  let address = ''
  try {
    const prepared = prepareRequest(spec, api, draft, window.location.origin, settings, adapter)
    curl = requestCurl(prepared)
    address = requestURL(prepared)
  } catch {
    /* Incomplete drafts remain editable. */
  }
  let responseBody = result?.body ?? ''
  if (responseTab === 'body') {
    try {
      responseBody = JSON.stringify(JSON.parse(responseBody), null, 2)
    } catch {
      /* Non-JSON responses are displayed as text. */
    }
  }
  const responseContent = responseTab === 'headers' ? (result?.headers ?? '') : responseBody
  function message(cause: unknown) {
    return cause instanceof RequestError
      ? t(`swagger.validation.${cause.code}`, { field: cause.field })
      : (cause as Error).message
  }
  function format() {
    try {
      const body = JSON.stringify(JSON.parse(draft.body), null, 2)
      setDraft((previous) => ({ ...previous, body }))
      setError('')
    } catch {
      setError(t('swagger.validation.json'))
    }
  }
  async function send() {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setSending(true)
    setError('')
    setNotice('')
    setResult(undefined)
    try {
      const prepared = prepareRequest(spec, api, draft, window.location.origin, settings, adapter)
      if (prepared.automaticAuth && authenticationProvider) {
        const headers = await authenticationProvider.getHeaders()
        Object.assign(prepared.headers, Object.fromEntries(
          Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
        ))
      }
      if (controller.signal.aborted) return
      const start = performance.now()
      const response = await fetch(prepared.url, {
        method: prepared.method,
        headers: prepared.headers,
        body: prepared.body,
        signal: controller.signal,
        redirect: 'error',
        cache: 'no-store',
      })
      if (response.status === 401 && prepared.automaticAuth) adapter?.authentication?.onUnauthorized?.()
      const body = await response.text()
      if (request.current !== controller || controller.signal.aborted) return
      revealResponse.current = true
      setResult({
        status: response.status,
        statusText: response.statusText,
        duration: Math.round(performance.now() - start),
        size: new TextEncoder().encode(body).length,
        body,
        headers: [...response.headers].map(([name, value]) => `${name}: ${value}`).join('\n'),
      })
      setResponseTab('body')
    } catch (cause) {
      if (request.current === controller && !controller.signal.aborted) setError(message(cause))
    } finally {
      if (request.current === controller) {
        request.current = null
        setSending(false)
      }
    }
  }
  return (
    <aside
      className="request-console"
      aria-label={t('swagger.debug')}
      onKeyDownCapture={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          event.stopPropagation()
          void send()
        }
      }}
    >
      <header className="console-title">
        <div>
          <Terminal size={17} />
          <h2>{t(api.protocol === 'innertop' ? 'swagger.innerTOPDebug' : 'swagger.debug')}</h2>
        </div>
        <span className="api-live-dot">{window.location.host}</span>
      </header>
      <p className="console-session-hint">{t('swagger.sessionHint')}</p>
      <div className="console-route">
        <span className={`http-method method-${api.method.toLowerCase()}`}>{api.method}</span>
        <code title={address}>{address || new URL(api.runtimePath, window.location.origin).href}</code>
        {address && <CopyButton value={address} />}
      </div>
      <div className="api-segments" aria-label={t('swagger.requestParts')}>
        {['parameters', ...(hasBody ? ['body'] : []), 'headers', 'auth'].map(
          (key) => (
            <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>
              {t(`swagger.${key}`)}
              {key !== 'body' && key !== 'auth' && (
                <small>
                  {
                    parameters.filter(
                      (parameter) =>
                        !parameter.authentication &&
                        (key === 'headers'
                          ? parameter.in === 'header'
                          : parameter.in === 'query' || parameter.in === 'path'),
                    ).length
                  }
                </small>
              )}
            </button>
          ),
        )}
      </div>
      {tab === 'body' ? (
        <RequestBodyEditor
          value={draft.body}
          onChange={(body) => setDraft((previous) => ({ ...previous, body }))}
          onFormat={format}
        />
      ) : (
        <>
          {tab === 'parameters' && identity && !api.actionVersion && (
            <div className="request-protocol">
              <label>
                {t('swagger.actionEncoding')}
                <Select
                  value={draft.actionEncoding}
                  showOptionDetails={false}
                  onValueChange={(value) =>
                    setDraft({ ...draft, actionEncoding: value as 'combined' | 'split' })
                  }
                >
                  <option value="split">Action + Version</option>
                  <option value="combined">{t('swagger.combinedAction')}</option>
                </Select>
              </label>
              <HelpTip
                label={t('swagger.actionEncoding')}
                description={t('swagger.actionDispatch', { action: api.action })}
              />
            </div>
          )}
          {tab === 'auth' && (
            <div className="request-inheritance">
              <div className="api-segments">
                <button
                  type="button"
                  aria-pressed={!draft.customAuth}
                  onClick={() => setDraft({ ...draft, customAuth: false })}
                >
                  {t('swagger.inheritAuth')}
                </button>
                <button
                  type="button"
                  aria-pressed={draft.customAuth}
                  onClick={() => setDraft({ ...draft, customAuth: true })}
                >
                  {t('swagger.customAuth')}
                </button>
                <HelpTip label={t('swagger.auth')} description={t('swagger.authHint')} />
              </div>
              <p className="api-muted auth-scope">{t(draft.customAuth ? 'swagger.customAuthScope' : 'swagger.inheritAuthScope')}</p>
              {!draft.customAuth && (
                <>
                  <div className="inherited-credentials">
                    {authentication.map((parameter) => {
                      const configured =
                        parameter.format === 'basic'
                          ? !!(effective.basic?.username || effective.basic?.password)
                          : !!effective.values[parameter.in + ':' + parameter.name] ||
                            (parameter.in === 'header' && parameter.name.toLowerCase() in automatic.headers)
                      return (
                        <div key={parameter.in + ':' + parameter.name}>
                          <code>{parameter.name}</code>
                          <span className={configured ? 'credential-ready' : 'api-muted'}>
                            {t(configured ? 'swagger.configured' : 'swagger.notConfigured')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <button type="button" onClick={onSettings}>
                    {t('swagger.manageSettings')}
                  </button>
                </>
              )}
            </div>
          )}
          {tab === 'headers' && (
            <div className="request-inheritance">
              <div className="heading-with-help">
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.inheritHeaders}
                    onChange={(event) => setDraft({ ...draft, inheritHeaders: event.target.checked })}
                  />
                  {t('swagger.inheritHeaders', { count: sharedHeaders.length })}
                </label>
                <HelpTip label={t('swagger.headers')} description={t('swagger.headerPrecedence')} />
              </div>
              {draft.inheritHeaders && sharedHeaders.length > 0 && (
                <div className="inherited-headers">
                  {sharedHeaders.map((header) => (
                    <div key={header.id}>
                      <code>{header.name}</code>
                      <span>
                        {header.secret || /token|authorization|cookie/i.test(header.name)
                          ? '••••••••'
                          : header.value || t('swagger.emptyValue')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={onSettings}>
                {t('swagger.manageSettings')}
              </button>
            </div>
          )}
          {tab === 'auth' && draft.customAuth && (
            <div className="request-auth-settings">
              <label className="authorization-select">
                {t('swagger.authorizationType')}
                <Select value={draft.authorization?.type ?? 'contract'} aria-label={t('swagger.authorizationType')} showOptionDetails={false}
                  onValueChange={(id) => setDraft((previous) => ({ ...previous,
                    authorization: id === 'contract' ? undefined : { type: id, credential: structuredClone(settings.credentials[id] ?? {}) },
                  }))}>
                  <option value="contract">{t('swagger.contractAuthorizations')}</option>
                  {draft.authorization && !selectedAuth && <option value={draft.authorization.type} disabled>{t('swagger.removedAuthorization')}</option>}
                  {authTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                </Select>
              </label>
              {selectedAuth && <>
                <div className="authorization-selection"><AuthorizationBadge type={selectedAuth} />
                  <code>{selectedAuth.fields.map((field) => field.name).join(' · ')}</code>
                  <HelpTip label={t('swagger.authorizationType')} description={t('swagger.authorizationOverrideHint')} />
                </div>
                <CredentialFields type={selectedAuth} value={draft.authorization!.credential}
                  onChange={(credential) => setDraft((previous) => ({ ...previous,
                    authorization: { type: selectedAuth.id, credential },
                  }))} />
              </>}
              {draft.authorization && !selectedAuth && <p className="request-error" role="alert">{t('swagger.validation.authTypeMissing')}</p>}
              <button type="button" onClick={onSettings}>{t('swagger.manageSettings')}</button>
              {authenticationProvider && supportsAutomaticAuth(spec, api, authenticationProvider) && (!draft.authorization || selectedAuth?.id === authenticationProvider.scheme) && (
                <label className="console-auth">
                  <ShieldCheck size={16} />
                  <span>{authenticationProvider.label()}</span>
                  <input
                    type="checkbox"
                    checked={draft.automaticAuth}
                    onChange={(event) => setDraft((previous) => ({ ...previous, automaticAuth: event.target.checked }))}
                  />
                </label>
              )}
              {!draft.authorization && draft.basic && (
                <div className="basic-auth-fields">
                  <span className="auth-scheme-label">HTTP Basic</span>
                  <label>
                    {t('swagger.username')}
                    <input
                      autoComplete="off"
                      value={draft.basic.username}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          basic: { ...previous.basic!, username: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t('swagger.password')}
                    <input
                      type="password"
                      autoComplete="off"
                      value={draft.basic.password}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          basic: { ...previous.basic!, password: event.target.value },
                        }))
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          )}
          {(tab !== 'auth' || (draft.customAuth && !draft.authorization && (!draft.basic || editable.length > 0))) && (
            <RequestFields
              parameters={editable}
              automaticHeaders={automatic.headers}
              draft={draft}
              inherited={tab === 'headers' ? inherited.values : {}}
              api={api}
              onChange={setDraft}
            />
          )}
        </>
      )}
      <div className="request-actions">
        <button
          type="button"
          className="primary-button request-send"
          title={t('swagger.sendShortcut')}
          onClick={
            sending
              ? () => {
                  request.current?.abort()
                  request.current = null
                  setSending(false)
                  setNotice(t('swagger.cancelled'))
                }
              : send
          }
        >
          {sending ? <Square size={15} /> : <ArrowUpRight size={16} />}
          {t(sending ? 'swagger.cancelRequest' : 'swagger.send')}
        </button>
        <kbd className="request-shortcut" aria-hidden="true">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} <CornerDownLeft size={12} /></kbd>
        <button
          type="button"
          title={t('swagger.reset')}
          aria-label={t('swagger.reset')}
          className="request-reset"
          disabled={sending}
          onClick={() => {
            setDraft(initialDraft(spec, api, adapter))
            setResult(undefined)
            setError('')
            setNotice('')
          }}
        >
          <RotateCcw size={15} />
        </button>
        <button type="button" className="curl-toggle" aria-expanded={showCurl} onClick={() => setShowCurl(!showCurl)}>
          <Terminal size={15} />
          cURL
        </button>
      </div>
      {error && (
        <p className="request-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      {notice && (
        <p className="api-muted" role="status">
          {notice}
        </p>
      )}
      {showCurl && (
        <div className="curl-preview">
          <div className="editor-toolbar">
            <span>{t('swagger.curlHint')}</span>
            {curl && <CopyButton value={curl} />}
          </div>
          <CodeBlock value={curl || t('swagger.completeRequest')} />
        </div>
      )}
      <section ref={responseView} className="response-view" aria-label={t('swagger.response')}>
        <header>
          <h3>{t('swagger.response')}</h3>
          {result && (
            <div className="response-meta" role="status">
              <span className={result.status < 400 ? 'response-ok' : 'response-failed'}>
                {result.status} {result.statusText}
              </span>
              <span>{result.duration} ms</span>
              <span>{result.size < 1024 ? `${result.size} B` : `${(result.size / 1024).toFixed(1)} KB`}</span>
            </div>
          )}
        </header>
        {result ? (
          <>
            <div className="response-toolbar">
              <div className="api-segments">
                {['body', 'raw', 'headers'].map((key) => (
                  <button
                    type="button"
                    key={key}
                    aria-pressed={responseTab === key}
                    onClick={() => setResponseTab(key)}
                  >
                    {t(
                      key === 'headers'
                        ? 'swagger.responseHeaders'
                        : key === 'body'
                          ? 'swagger.responseBody'
                          : 'swagger.raw',
                    )}
                  </button>
                ))}
              </div>
              <div className="response-tools">
                <button
                  type="button"
                  aria-label={t('swagger.wrap')}
                  title={t('swagger.wrap')}
                  aria-pressed={wrap}
                  onClick={() => setWrap(!wrap)}
                >
                  <WrapText size={15} />
                </button>
                <CopyButton value={responseContent} />
                <button
                  type="button"
                  aria-label={t('swagger.downloadResponse')}
                  title={t('swagger.downloadResponse')}
                  onClick={() => download(new Blob([result.body], { type: 'text/plain' }), 'response.txt')}
                >
                  <Download size={15} />
                </button>
                <button
                  type="button"
                  aria-label={t('swagger.clearResponse')}
                  title={t('swagger.clearResponse')}
                  onClick={() => setResult(undefined)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <CodeBlock
              className="response-code"
              value={responseContent || t('swagger.emptyResponse')}
              json={responseTab === 'body' && /^[\s]*[\[{]/.test(responseBody)}
              wrap={wrap}
            />
          </>
        ) : (
          <div className="response-empty">
            {sending && <span className="request-progress" />}
            {!sending && <Inbox size={22} strokeWidth={1.5} aria-hidden="true" />}
            <strong>{t(sending ? 'swagger.sending' : 'swagger.readyToSend')}</strong>
            <p>{t(sending ? 'swagger.waitResponse' : 'swagger.responseHint')}</p>
          </div>
        )}
      </section>
    </aside>
  )
}

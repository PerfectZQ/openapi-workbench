import { Fragment, useRef, useState } from 'react'
import { Check, ChevronRight, Download, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { HelpTip } from '@workbench/ui/HelpTip'
import { actionIdentity, formatGroupLabel, operationGroup, operationLifecycle, type APIOperation, type Specification } from './contract'
import { schemaExample } from './request'
import { SchemaReference } from './SchemaReference'
import { FieldRow, FieldTable } from './FieldTable'
import { RequestConsole } from './RequestConsole'
import { CopyButton } from '@workbench/ui/CopyButton'
import type { RequestAdapter } from './host'
import type { RequestSettings } from './settings'
import { CodeBlock } from './CodeBlock'
import { EnumValues } from './EnumValues'
import { AuthorizationRequirements } from './AuthorizationBadge'

export function OperationDetail({
  spec,
  api,
  settings,
  onSettings,
  requestAdapter,
  onExport,
  protocols,
  onProtocol,
}: {
  spec: Specification
  api: APIOperation
  settings: RequestSettings
  onSettings(): void
  onExport?(): void
  requestAdapter?: RequestAdapter
  protocols: APIOperation[]
  onProtocol(api: APIOperation): void
}) {
  const { t } = useTranslation()
  const workspace = useRef<HTMLDivElement>(null)
  const [responseCode, setResponseCode] = useState(Object.keys(api.operation.responses)[0])
  const [responseMode, setResponseMode] = useState('schema')
  const identity = actionIdentity(api)
  const lifecycle = operationLifecycle(api.operation)
  const body = api.operation.parameters?.find((parameter) => parameter.in === 'body')
  const query = api.operation.parameters?.filter((parameter) => ['path', 'query'].includes(parameter.in)) ?? []
  const response = api.operation.responses[responseCode]
  return (
    <div className={`operation-workspace protocol-${api.protocol}`} ref={workspace}>
      <nav className="operation-jumps" aria-label={t('swagger.workspaceSections')}>
        <button type="button" onClick={() => workspace.current?.scrollTo(0, 0)}>
          {t('swagger.reference')}
        </button>
        <button
          type="button"
          onClick={() => workspace.current?.querySelector('.request-console')?.scrollIntoView({ block: 'start' })}
        >
          {t('swagger.debug')}
        </button>
      </nav>
      <article className="operation-reference">
        <div className="api-breadcrumb">
          <span>{t('swagger.reference')}</span>
          {operationGroup(api).map((part, index) => <Fragment key={index}>
            <ChevronRight size={13} aria-hidden="true" /><span>{formatGroupLabel(part)}</span>
          </Fragment>)}
        </div>
        <div className="operation-heading">
          {protocols.length > 1 && (
            <div className="api-segments" role="group" aria-label={t('swagger.requestProtocol')}>
              {protocols.map((entry) => (
                <button key={entry.key} type="button" aria-pressed={api.key === entry.key} onClick={() => onProtocol(entry)}>
                  {t(`swagger.protocol.${entry.protocol}`)}
                </button>
              ))}
            </div>
          )}
          <div className="operation-eyebrow">
            <span className="heading-with-help">
              <span className={`protocol-label protocol-${api.protocol}`}>{t(`swagger.protocol.${api.protocol}`)}</span>
              <HelpTip
                label={t('swagger.protocolRecognition')}
                description={
                  <>
                    <p>{t('swagger.protocolHint.' + api.protocol)}</p>
                    <p>{t('swagger.protocolRule.' + api.protocol)}</p>
                    {api.action && <p>{t('swagger.actionDispatch', { action: api.action })}</p>}
                  </>
                }
                wide
              />
            </span>
            <span className={`http-method method-${api.method.toLowerCase()}`}>{api.method}</span>
            {api.operation.operationId && <code>{api.operation.operationId}</code>}
          </div>
          <h1 tabIndex={-1}>{api.operation.summary || api.action || api.path}</h1>
          {lifecycle !== 'active' && (
            <section className="api-lifecycle-notice" aria-label={t(`swagger.lifecycle.${lifecycle}`)}>
              <TriangleAlert size={18} aria-hidden="true" />
              <div>
                <h2>{t(`swagger.lifecycle.${lifecycle}`)}</h2>
                <p>{api.operation['x-api-lifecycle']?.description || t(`swagger.lifecycle.${lifecycle}Hint`)}</p>
              </div>
            </section>
          )}
          {api.operation.description && (
            <section className="api-description" aria-label={t('swagger.operationDescription')}>
              <h2>{t('swagger.operationDescription')}</h2>
              {api.operation.description.split(/\n+/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </section>
          )}
        </div>
        <div className="operation-address">
          <code>{api.runtimePath}</code>
          <CopyButton
            value={
              new URL(api.runtimePath, window.location.origin).href +
              (api.action ? `?Action=${encodeURIComponent(api.action)}${api.actionVersion ? `&Version=${api.actionVersion}` : ''}` : '')
            }
          />
        </div>
        <div className="operation-utilities">
          <AuthorizationRequirements spec={spec} api={api} />
          <CopyButton value={window.location.href} label={t('swagger.copyLink')} />
          {api.protocol === 'innertop' && onExport && (
            <button type="button" className="operation-export" onClick={onExport} aria-haspopup="dialog">
              <Download size={16} aria-hidden="true" />
              {t('swagger.exportCurrent')}
            </button>
          )}
        </div>
        {query.length > 0 && (
          <section className="reference-section">
            <div className="section-heading">
              <h2>{t('swagger.parameters')}</h2>
              <span>{t('swagger.queryAndPath')}</span>
            </div>
            <FieldTable label={t('swagger.parameters')}>
              {query.map((parameter) => {
                const system =
                  api.protocol === 'innertop' &&
                  parameter.in === 'query' &&
                  ['Action', 'Version'].includes(parameter.name)
                const value = system
                  ? parameter.name === 'Action'
                    ? (identity?.name ?? api.action)
                    : (identity?.version ?? parameter.default)
                  : parameter.default
                return (
                  <FieldRow
                    key={`${parameter.in}:${parameter.name}`}
                    name={parameter.name}
                    system={system}
                    type={parameter.type ?? 'string'}
                    required={!!parameter.required}
                  >
                    {parameter.description && <p>{parameter.description}</p>}
                    {!system && <EnumValues schema={parameter} />}
                    {value !== undefined && (
                      <p className="schema-default">
                        {t(system ? 'swagger.fixedValue' : 'swagger.defaultValue')}: <code>{String(value)}</code>
                      </p>
                    )}
                    {!parameter.description && value === undefined && <span className="api-muted">—</span>}
                  </FieldRow>
                )
              })}
            </FieldTable>
          </section>
        )}
        {body?.schema && (
          <section className="reference-section">
            <div className="section-heading">
              <h2>{t('swagger.requestBody')}</h2>
              <span>application/json</span>
            </div>
            {body.description && <p className="api-muted">{body.description}</p>}
            <SchemaReference spec={spec} schema={body.schema} label={t('swagger.requestBody')} />
          </section>
        )}
        <section className="reference-section">
          <div className="section-heading">
            <h2>{t('swagger.responseSchema')}</h2>
            <span>application/json</span>
          </div>
          <div className="response-status-list" role="group" aria-label={t('swagger.responseStatus')}>
            {Object.entries(api.operation.responses).map(([code, definition]) => (
              <button
                type="button"
                key={code}
                aria-pressed={responseCode === code}
                onClick={() => setResponseCode(code)}
              >
                <code
                  className={`response-status-code ${/^2/.test(code) ? 'is-success' : /^[45]/.test(code) ? 'is-error' : ''}`}
                >
                  {code}
                </code>
                <span>{definition.description || t('swagger.noDescription')}</span>
                {responseCode === code ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <ChevronRight size={15} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
          <div className="response-schema-controls">
            <span>
              HTTP <code>{responseCode}</code>
            </span>
            <div className="api-segments" role="group" aria-label={t('swagger.responseContent')}>
              {['schema', 'example'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={responseMode === mode}
                  onClick={() => setResponseMode(mode)}
                >
                  {t(mode === 'schema' ? 'swagger.schemaValue' : 'swagger.exampleValue')}
                </button>
              ))}
            </div>
          </div>
          {response?.schema ? (
            responseMode === 'schema' ? (
              <SchemaReference spec={spec} schema={response.schema} label={t('swagger.responseSchema')} />
            ) : (
              <div className="response-example">
                <div className="editor-toolbar">
                  <code>response.json</code>
                  <CopyButton value={JSON.stringify(schemaExample(spec, response.schema), null, 2)} />
                </div>
                <CodeBlock value={JSON.stringify(schemaExample(spec, response.schema), null, 2)} json />
              </div>
            )
          ) : (
            <p className="api-muted">{t('swagger.noSchema')}</p>
          )}
        </section>
      </article>
      <RequestConsole key={api.key} spec={spec} api={api} settings={settings} onSettings={onSettings} adapter={requestAdapter} />
    </div>
  )
}

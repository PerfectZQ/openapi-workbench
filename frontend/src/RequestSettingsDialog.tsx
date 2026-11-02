import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HelpTip } from '@workbench/ui/HelpTip'
import { newUUID } from '@workbench/ui/identity'
import { KeyRound, Plus, Trash2, X } from 'lucide-react'
import type { AutomaticAuthentication } from './host'
import type { Specification } from './contract'
import { authorizationTypes, customAuthorizationIssue } from './authorization'
import { AuthorizationBadge } from './AuthorizationBadge'
import { CredentialFields } from './CredentialFields'
import { CustomAuthorizationFields } from './CustomAuthorizationFields'
import { emptySettings, headerIssue, type Credential, type RequestSettings } from './settings'

export function RequestSettingsDialog({
  spec,
  settings,
  authentication,
  onSave,
  onClose,
}: {
  spec: Specification
  authentication?: AutomaticAuthentication
  settings: RequestSettings
  onSave(settings: RequestSettings): void
  onClose(): void
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const id = useId()
  const [draft, setDraft] = useState(() => structuredClone(settings))
  const [tab, setTab] = useState('standardAuthorizations')
  const types = authorizationTypes(spec, draft.customAuthorizations)
  const issue = headerIssue(draft.headers) ?? customAuthorizationIssue(spec, draft.customAuthorizations)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = dialog.current!
    element.showModal()
    title.current?.focus()
    return () => {
      element.close()
      previous?.focus()
    }
  }, [])
  function credential(name: string, value: Credential) {
    setDraft((previous) => ({ ...previous, credentials: { ...previous.credentials, [name]: value } }))
  }
  return (
    <dialog
      ref={dialog}
      className="request-settings-dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <header>
        <div className="heading-with-help">
          <h2 id={id} ref={title} tabIndex={-1}>
            <KeyRound size={19} />
            {t('swagger.settingsTitle')}
          </h2>
          <HelpTip
            label={t('swagger.settingsTitle')}
            description={
              <>
                <p>{t('swagger.settingsHint')}</p>
                <p>{t(tab === 'sharedHeaders' ? 'swagger.sharedHeadersHint' : 'swagger.authorizationTypesHint')}</p>
              </>
            }
            wide
          />
        </div>
        <button type="button" aria-label={t('swagger.close')} onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="api-segments settings-tabs">
        {['standardAuthorizations', 'customAuthorizations', 'sharedHeaders'].map((key) => (
          <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>
            {t(`swagger.${key}`)}
            {key === 'sharedHeaders' && <small>{draft.headers.filter((header) => header.enabled).length}</small>}
          </button>
        ))}
      </div>
      <div className="settings-content">
        {tab !== 'sharedHeaders' ? (
          <>
            <div className="settings-schemes">
              {types
                .filter((type) => (type.kind !== 'custom') === (tab === 'standardAuthorizations'))
                .map((type) => {
                  const value = draft.credentials[type.id] ?? {}
                  const custom = draft.customAuthorizations.find((item) => item.id === type.id)
                  const configured =
                    type.kind === 'basic'
                      ? !!value.username
                      : type.userDefined
                        ? type.fields.length > 0 && type.fields.every((field) => !!value.headers?.[field.name])
                        : !!value.value || (type.id === authentication?.scheme && draft.automaticAuth)
                  return (
                    <details className="settings-scheme" key={type.id} open={custom ? true : undefined}>
                      <summary>
                        <span>
                          <span className="authorization-name">
                            <strong>{type.name || t('swagger.newAuthorization')}</strong>
                            <AuthorizationBadge type={type} />
                          </span>
                          <small>
                            {type.fields
                              .map(
                                (field) =>
                                  `${field.in} · ${field.name}${type.kind === 'basic' ? ': Basic …' : type.kind === 'bearer' ? ': Bearer …' : ''}`,
                              )
                              .join(' / ')}
                          </small>
                        </span>
                        <span className={configured ? 'credential-ready' : 'api-muted'}>
                          {t(configured ? 'swagger.configured' : 'swagger.notConfigured')}
                        </span>
                      </summary>
                      <div className="settings-scheme-fields">
                        {type.description && <p className="api-muted">{type.description}</p>}
                        {authentication && type.id === authentication.scheme && (
                          <label className="settings-checkbox">
                            <input
                              type="checkbox"
                              checked={draft.automaticAuth}
                              onChange={(event) => setDraft({ ...draft, automaticAuth: event.target.checked })}
                            />
                            {authentication.label()}
                          </label>
                        )}
                        {custom ? (
                          <CustomAuthorizationFields
                            type={custom}
                            credential={value}
                            onCredential={(value) => credential(type.id, value)}
                            onChange={(next) =>
                              setDraft((previous) => ({
                                ...previous,
                                customAuthorizations: previous.customAuthorizations.map((item) =>
                                  item.id === next.id ? next : item,
                                ),
                              }))
                            }
                          />
                        ) : (
                          <CredentialFields
                            type={type}
                            value={value}
                            onChange={(value) => credential(type.id, value)}
                          />
                        )}
                        <div className="authorization-actions">
                          <button type="button" onClick={() => credential(type.id, {})}>
                            {t('swagger.clearCredential')}
                          </button>
                          {custom && (
                            <button
                              type="button"
                              onClick={() =>
                                setDraft((previous) => {
                                  const credentials = { ...previous.credentials }
                                  delete credentials[type.id]
                                  return {
                                    ...previous,
                                    credentials,
                                    customAuthorizations: previous.customAuthorizations.filter(
                                      (item) => item.id !== type.id,
                                    ),
                                  }
                                })
                              }
                            >
                              <Trash2 size={15} />
                              {t('swagger.removeAuthorization')}
                            </button>
                          )}
                        </div>
                      </div>
                    </details>
                  )
                })}
            </div>
            {tab === 'customAuthorizations' && (
              <button
                type="button"
                className="add-authorization"
                onClick={() =>
                  setDraft((previous) => ({
                    ...previous,
                    customAuthorizations: [
                      ...previous.customAuthorizations,
                      { id: newUUID(), name: '', headers: [''] },
                    ],
                  }))
                }
              >
                <Plus size={15} />
                {t('swagger.addAuthorization')}
              </button>
            )}
          </>
        ) : (
          <>
            <div className="shared-header-list">
              {draft.headers.map((header, index) => {
                const update = (patch: Partial<typeof header>) =>
                  setDraft((previous) => ({
                    ...previous,
                    headers: previous.headers.map((item) => (item.id === header.id ? { ...item, ...patch } : item)),
                  }))
                return (
                  <div className={`shared-header-row ${header.enabled ? '' : 'is-disabled'}`} key={header.id}>
                    <label className="settings-checkbox">
                      <input
                        type="checkbox"
                        checked={header.enabled}
                        onChange={(event) => update({ enabled: event.target.checked })}
                      />
                      {t('swagger.enabled')}
                    </label>
                    <label>
                      {t('swagger.headerName')}
                      <input
                        aria-label={t('swagger.headerNameAt', { index: index + 1 })}
                        value={header.name}
                        placeholder="X-Request-ID"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(event) => update({ name: event.target.value })}
                      />
                    </label>
                    <label>
                      {t('swagger.headerValue')}
                      <input
                        aria-label={t('swagger.headerValueAt', { index: index + 1 })}
                        type={header.secret ? 'password' : 'text'}
                        value={header.value}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(event) => update({ value: event.target.value })}
                      />
                    </label>
                    <label className="settings-checkbox">
                      <input
                        type="checkbox"
                        checked={header.secret}
                        onChange={(event) => update({ secret: event.target.checked })}
                      />
                      {t('swagger.secret')}
                    </label>
                    <button
                      type="button"
                      aria-label={t('swagger.removeHeader', { index: index + 1 })}
                      onClick={() =>
                        setDraft({ ...draft, headers: draft.headers.filter((item) => item.id !== header.id) })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
            {!draft.headers.length && <div className="settings-empty">{t('swagger.noSharedHeaders')}</div>}
            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  headers: [
                    ...draft.headers,
                    { id: newUUID(), name: '', value: '', enabled: true, secret: false },
                  ],
                })
              }
            >
              <Plus size={15} />
              {t('swagger.addHeader')}
            </button>
          </>
        )}
        {issue && (
          <p className="request-error" role="alert">
            {t(`swagger.validation.${issue.code}`, { field: issue.field })}
          </p>
        )}
      </div>
      <footer>
        <button type="button" onClick={() => setDraft(structuredClone(emptySettings))}>
          {t('swagger.resetSettings')}
        </button>
        <span />
        <button type="button" onClick={onClose}>
          {t('swagger.cancel')}
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={!!issue}
          onClick={() => {
            onSave({
              ...draft,
              customAuthorizations: draft.customAuthorizations.map((type) => ({ ...type, name: type.name.trim() })),
            })
            onClose()
          }}
        >
          {t('swagger.applySettings')}
        </button>
      </footer>
    </dialog>
  )
}

import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Credential, CustomAuthorization } from './settings'

export function CustomAuthorizationFields({
  type,
  credential,
  onChange,
  onCredential,
}: {
  type: CustomAuthorization
  credential: Credential
  onChange(type: CustomAuthorization): void
  onCredential(credential: Credential): void
}) {
  const { t } = useTranslation()
  return (
    <div className="custom-authorization-fields">
      <label>
        {t('swagger.authorizationName')}
        <input
          value={type.name}
          autoFocus={!type.name}
          autoComplete="off"
          placeholder={t('swagger.authorizationNamePlaceholder')}
          onChange={(event) => onChange({ ...type, name: event.target.value })}
        />
      </label>
      {type.headers.map((name, index) => (
        <div className="authorization-header-row" key={index}>
          <label>
            {t('swagger.headerName')}
            <input
              value={name}
              autoComplete="off"
              spellCheck={false}
              placeholder="X-API-Key"
              aria-label={t('swagger.headerNameAt', { index: index + 1 })}
              onChange={(event) => {
                const next = event.target.value.trim()
                const headers = { ...credential.headers }
                delete headers[name]
                headers[next] = credential.headers?.[name] ?? ''
                onCredential({ headers })
                onChange({ ...type, headers: type.headers.map((header, at) => (at === index ? next : header)) })
              }}
            />
          </label>
          <label>
            {t('swagger.headerValue')}
            <input
              type="password"
              value={credential.headers?.[name] ?? ''}
              autoComplete="off"
              spellCheck={false}
              aria-label={t('swagger.headerValueAt', { index: index + 1 })}
              onChange={(event) => onCredential({ headers: { ...credential.headers, [name]: event.target.value } })}
            />
          </label>
          <button
            type="button"
            aria-label={t('swagger.removeHeader', { index: index + 1 })}
            onClick={() => {
              const headers = { ...credential.headers }
              delete headers[name]
              onCredential({ headers })
              onChange({ ...type, headers: type.headers.filter((_, at) => at !== index) })
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...type, headers: [...type.headers, ''] })}>
        <Plus size={15} />
        {t('swagger.addHeader')}
      </button>
    </div>
  )
}

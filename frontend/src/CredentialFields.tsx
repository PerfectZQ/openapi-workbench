import { useTranslation } from 'react-i18next'
import type { AuthorizationType } from './authorization'
import type { Credential } from './settings'

export function CredentialFields({
  type,
  value,
  onChange,
}: {
  type: AuthorizationType
  value: Credential
  onChange(value: Credential): void
}) {
  const { t } = useTranslation()
  if (type.kind === 'basic')
    return (
      <div className="basic-auth-fields">
        <label>
          {t('swagger.username')}
          <input
            autoComplete="off"
            value={value.username ?? ''}
            onChange={(event) => onChange({ ...value, username: event.target.value })}
          />
        </label>
        <label>
          {t('swagger.password')}
          <input
            type="password"
            autoComplete="off"
            value={value.password ?? ''}
            onChange={(event) => onChange({ ...value, password: event.target.value })}
          />
        </label>
      </div>
    )
  return (
    <div className="authorization-fields">
      {type.kind === 'bearer' ? (
        <label>
          {t('swagger.bearerToken')}
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={value.value ?? ''}
            placeholder={t('swagger.bearerPlaceholder')}
            onChange={(event) => onChange({ value: event.target.value })}
          />
        </label>
      ) : (
        type.fields.map((field) => (
          <label key={field.in + ':' + field.name}>
            <code>{field.name}</code>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={type.userDefined ? (value.headers?.[field.name] ?? '') : (value.value ?? '')}
              placeholder={t('swagger.credentialPlaceholder')}
              onChange={(event) =>
                onChange(
                  type.userDefined
                    ? { headers: { ...value.headers, [field.name]: event.target.value } }
                    : { value: event.target.value },
                )
              }
            />
          </label>
        ))
      )}
    </div>
  )
}

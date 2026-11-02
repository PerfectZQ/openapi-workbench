import { Fragment } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { APIOperation, Specification } from './contract'
import { authorizationRequirements, authorizationTypes, type AuthorizationType } from './authorization'
import './authorization.css'

export function AuthorizationBadge({ type }: { type: AuthorizationType }) {
  const { t } = useTranslation()
  return (
    <span className={`authorization-badge is-${type.kind === 'custom' ? 'custom' : 'standard'}`}>
      {t(type.kind === 'custom' ? 'swagger.customAuthorization' : 'swagger.builtinAuthorization')}
    </span>
  )
}

export function AuthorizationRequirements({ spec, api }: { spec: Specification; api: APIOperation }) {
  const { t } = useTranslation()
  const types = authorizationTypes(spec)
  const requirements = authorizationRequirements(spec, api)
  return (
    <div className="authorization-requirements" aria-label={t('swagger.auth')}>
      <ShieldCheck size={15} aria-hidden="true" />
      {!requirements.length && <span>{t('swagger.publicAPI')}</span>}
      {requirements.map((names, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="authorization-operator">{t('swagger.authOr')}</span>}
          <div className="authorization-requirement">
            {!names.length && <span>{t('swagger.publicAPI')}</span>}
            {names.map((name, position) => {
              const type = types.find((item) => item.id === name)
              return (
                <span className="authorization-identity" key={name}>
                  {position > 0 && <span className="authorization-operator">{t('swagger.authAnd')}</span>}
                  <span className="authorization-name">
                    {type?.name ?? name}
                    {type && <AuthorizationBadge type={type} />}
                  </span>
                  {type && (
                    <code>
                      {type.fields
                        .map(
                          (field) =>
                            `${field.in === 'header' ? '' : field.in + ': '}${field.name}${type.kind === 'basic' ? ': Basic …' : ''}`,
                        )
                        .join(' · ')}
                    </code>
                  )}
                </span>
              )
            })}
          </div>
        </Fragment>
      ))}
    </div>
  )
}

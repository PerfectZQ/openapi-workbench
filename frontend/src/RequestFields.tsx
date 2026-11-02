import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { HelpTip } from './ui/HelpTip'
import { Select } from './ui/Select'
import { actionIdentity, type APIOperation } from './contract'
import type { RequestDraft, requestParameters } from './request'

export function RequestFields({
  parameters,
  automaticHeaders,
  draft,
  api,
  inherited,
  onChange,
}: {
  automaticHeaders: Record<string, string>
  parameters: ReturnType<typeof requestParameters>
  draft: RequestDraft
  api: APIOperation
  inherited: Record<string, string>
  onChange(draft: RequestDraft): void
}) {
  const { t } = useTranslation()
  const id = useId()
  const identity = actionIdentity(api)
  return (
    <div className="request-parameters api-field-table-scroll">
      {parameters.length > 0 && (
        <table className="api-field-table request-field-table" aria-label={t('swagger.requestParts')}>
          <colgroup>
            <col className="request-field-name-column" />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{t('swagger.fieldName')}</th>
              <th scope="col">{t('swagger.headerValue')}</th>
            </tr>
          </thead>
          <tbody>
            {parameters.map((parameter) => {
              const key = `${parameter.in}:${parameter.name}`
              const automatic =
                parameter.in === 'header' &&
                parameter.name.toLowerCase() in automaticHeaders &&
                !(key in draft.values) && !(key in inherited)
              const system =
                api.protocol === 'innertop' &&
                parameter.in === 'query' &&
                ['Action', 'Version'].includes(parameter.name)
              const locked = system && (parameter.name === 'Action' || !!identity)
              const omittedVersion =
                system && parameter.name === 'Version' && !!identity && draft.actionEncoding === 'combined'
              let value = draft.values[key] ?? inherited[key] ?? ''
              if (system && parameter.name === 'Action')
                value = identity && draft.actionEncoding === 'split' ? identity.name : api.action
              if (system && parameter.name === 'Version' && identity) value = omittedVersion ? '' : identity.version
              const hasInherited = key in inherited
              const toggleable =
                (!hasInherited && !parameter.required && !automatic && !locked && !parameter.authentication) ||
                parameter.format === 'password'
              const enabled = !omittedVersion && (!toggleable || key in draft.values)
              const fieldID = `${id}-${key}`
              const update = (value: string) => onChange({ ...draft, values: { ...draft.values, [key]: value } })
              return (
                <tr
                  className={`request-parameter ${system ? 'system-parameter' : ''} ${!enabled ? 'is-omitted' : ''}`}
                  key={key}
                >
                  <th scope="row">
                    <div className="parameter-heading">
                      <div className="parameter-name">
                        <label htmlFor={fieldID}>
                          <code>{parameter.name}</code>
                          {parameter.required && <b aria-label={t('swagger.required')}>*</b>}
                        </label>
                        {system && <span className="api-system-tag">{t('swagger.systemParameter')}</span>}
                        {parameter.description && (
                          <HelpTip label={parameter.name} description={parameter.description} />
                        )}
                      </div>
                      {hasInherited ? (
                        <button
                          type="button"
                          className="parameter-source"
                          disabled={!(key in draft.values)}
                          onClick={() => {
                            const values = { ...draft.values }
                            delete values[key]
                            onChange({ ...draft, values })
                          }}
                        >
                          {t(key in draft.values ? 'swagger.restoreShared' : 'swagger.inherited')}
                        </button>
                      ) : toggleable ? (
                        <label className="parameter-enable">
                          <input
                            type="checkbox"
                            checked={enabled}
                            aria-label={t('swagger.includeParameter', { name: parameter.name })}
                            onChange={(event) => {
                              const values = { ...draft.values }
                              if (event.target.checked)
                                values[key] = String(parameter.default ?? parameter.enum?.[0] ?? '')
                              else delete values[key]
                              onChange({ ...draft, values })
                            }}
                          />
                          {t(enabled ? 'swagger.included' : 'swagger.omitted')}
                        </label>
                      ) : (
                        <small>
                          {omittedVersion
                            ? t('swagger.omitted')
                            : automatic
                              ? t('swagger.automatic')
                              : locked
                                ? t('swagger.fixedValue')
                                : parameter.in}
                        </small>
                      )}
                    </div>
                  </th>
                  <td>
                    {parameter.enum && !locked ? (
                      <Select
                        id={fieldID}
                        value={value}
                        disabled={!enabled}
                        onValueChange={update}
                        showOptionDetails={false}
                      >
                        {!parameter.enum.includes('') && <option value="">{t('swagger.emptyValue')}</option>}
                        {parameter.enum.map((value) => (
                          <option key={String(value)} value={String(value)}>
                            {value === '' ? t('swagger.emptyString') : String(value)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <input
                        id={fieldID}
                        type={
                          parameter.authentication || parameter.format === 'password'
                            ? 'password'
                            : parameter.type === 'integer' || parameter.type === 'number'
                              ? 'number'
                              : 'text'
                        }
                        autoComplete="off"
                        spellCheck={false}
                        disabled={!enabled}
                        readOnly={locked || automatic}
                        value={automatic ? '' : value}
                        placeholder={
                          !enabled
                            ? t('swagger.omitted')
                            : automatic
                              ? t('swagger.automaticHint')
                              : parameter.type === 'string' || !parameter.type
                                ? t('swagger.emptyString')
                                : t('swagger.enterValue')
                        }
                        onChange={(event) => update(event.target.value)}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {!parameters.length && <p className="api-muted">{t('swagger.noParameters')}</p>}
    </div>
  )
}

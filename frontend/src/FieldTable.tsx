import type { CSSProperties, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import './field-table.css'

export function FieldTable({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="api-field-table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className="api-field-table api-reference-table" aria-label={label}>
        <colgroup>
          <col className="field-name-column" />
          <col className="field-type-column" />
          <col className="field-required-column" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{t('swagger.fieldName')}</th>
            <th scope="col">{t('swagger.fieldType')}</th>
            <th scope="col">{t('swagger.fieldRequired')}</th>
            <th scope="col">{t('swagger.fieldDescription')}</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function FieldRow({
  name,
  type,
  required,
  system,
  depth = 0,
  expanded,
  onToggle,
  children,
}: {
  name: string
  type: string
  required?: boolean
  system?: boolean
  depth?: number
  expanded?: boolean
  onToggle?(): void
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <tr className={depth ? 'is-nested' : undefined} data-expanded={expanded || undefined}>
      <th scope="row" style={{ '--field-depth': depth } as CSSProperties}>
        <div className="field-identity">
          {onToggle ? (
            <button
              type="button"
              className="field-disclosure"
              aria-expanded={expanded}
              aria-label={t(expanded ? 'swagger.collapseField' : 'swagger.expandField', { name })}
              onClick={onToggle}
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          ) : (
            <span className="field-disclosure-space" aria-hidden="true" />
          )}
          <div className="field-name">
            <code>{name}</code>
            {system && <span className="api-system-tag">{t('swagger.systemParameter')}</span>}
          </div>
        </div>
      </th>
      <td><code className="field-type">{type}</code></td>
      <td className="field-requirement">
        <span className={required ? 'api-required' : 'field-optional'}>
          {t(required ? 'swagger.required' : 'swagger.optional')}
        </span>
      </td>
      <td className="field-description">{children}</td>
    </tr>
  )
}

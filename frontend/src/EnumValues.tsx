import { useTranslation } from 'react-i18next'
import { enumValues } from './contract'

/** Keep the wire value beside its meaning; labels never replace request values. */
export function EnumValues({ schema }: { schema: Parameters<typeof enumValues>[0] }) {
  const { t } = useTranslation()
  const values = enumValues(schema)
  if (!values.length) return null
  return (
    <dl className="schema-enum-values" aria-label={t('swagger.enumValues')}>
      {values.map(({ value, name, description }) => (
        <div key={JSON.stringify(value)}>
          <dt><code>{JSON.stringify(value)}</code></dt>
          <dd>{description || name || t('swagger.enumLiteral')}</dd>
        </div>
      ))}
    </dl>
  )
}

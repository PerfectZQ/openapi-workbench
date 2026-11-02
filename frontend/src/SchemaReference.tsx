import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resolveSchema, type Schema, type Specification } from './contract'
import { FieldRow, FieldTable } from './FieldTable'
import { EnumValues } from './EnumValues'

export function SchemaReference({ spec, schema, label }: { spec: Specification; schema: Schema; label: string }) {
  const { t } = useTranslation()
  const resolved = resolveSchema(spec, schema)
  if (resolved.type === 'array' && resolved.items) {
    const item = resolveSchema(spec, resolved.items)
    return (
      <>
        <p className="api-muted">{t('swagger.arrayItems')}</p>
        <SchemaReference spec={spec} schema={{ ...item, 'x-enum-descriptions': item['x-enum-descriptions'] ?? resolved['x-enum-descriptions'] }} label={label} />
      </>
    )
  }
  if (!Object.keys(resolved.properties ?? {}).length) {
    return (
      <div className="schema-value">
        <code>{resolved.type ?? 'object'}</code>
        {resolved.description && <p>{resolved.description}</p>}
        <EnumValues schema={resolved} />
        {resolved.additionalProperties && <p>{t('swagger.dynamicFields')}</p>}
      </div>
    )
  }
  return (
    <FieldTable label={label}>
      <SchemaRows spec={spec} schema={schema} />
    </FieldTable>
  )
}

function SchemaRows({
  spec,
  schema,
  depth = 0,
  ancestors = [],
}: {
  spec: Specification
  schema: Schema
  depth?: number
  ancestors?: string[]
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(new Set<string>())
  const resolved = resolveSchema(spec, schema)
  const references = schema.$ref ? [...ancestors, schema.$ref] : ancestors
  return Object.entries(resolved.properties ?? {}).map(([name, raw]) => {
    const field = resolveSchema(spec, raw)
    const child = field.type === 'array' ? field.items : raw
    const recursive = !!child?.$ref && references.includes(child.$ref)
    const expandable =
      child && !recursive && depth < 8 && !!Object.keys(resolveSchema(spec, child).properties ?? {}).length
    const type =
      (field.type ?? (field.properties ? 'object' : 'any')) +
      (field.type === 'array' ? `<${field.items ? (resolveSchema(spec, field.items).type ?? 'object') : 'any'}>` : '') +
      (field.format ? ` · ${field.format}` : '')
    return (
      <Fragment key={name}>
        <FieldRow
          name={name}
          type={type}
          required={resolved.required?.includes(name)}
          depth={depth}
          expanded={expandable ? expanded.has(name) : undefined}
          onToggle={
            expandable
              ? () => setExpanded((previous) => {
                  const next = new Set(previous)
                  if (next.has(name)) next.delete(name)
                  else next.add(name)
                  return next
                })
              : undefined
          }
        >
          {field.description && <p>{field.description}</p>}
          {field.additionalProperties && <p>{t('swagger.dynamicFields')}</p>}
          {field.default !== undefined && (
            <p className="schema-default">
              {t('swagger.defaultValue')}: <code>{JSON.stringify(field.default)}</code>
            </p>
          )}
          <EnumValues schema={field.type === 'array' && field.items ? { ...field, ...resolveSchema(spec, field.items) } : field} />
          {recursive && <p className="api-muted">{child?.$ref?.split('/').at(-1)}</p>}
          {!field.description &&
            !field.additionalProperties &&
            field.default === undefined &&
            !field.enum &&
            !recursive && <span className="api-muted">—</span>}
        </FieldRow>
        {expandable && expanded.has(name) && (
          <SchemaRows spec={spec} schema={child} depth={depth + 1} ancestors={references} />
        )}
      </Fragment>
    )
  })
}

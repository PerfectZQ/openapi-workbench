export interface Schema {
  $ref?: string
  type?: string
  format?: string
  description?: string
  properties?: Record<string, Schema>
  required?: string[]
  items?: Schema
  allOf?: Schema[]
  additionalProperties?: Schema | boolean
  example?: unknown
  enum?: unknown[]
  'x-enum-varnames'?: string[]
  'x-enum-descriptions'?: string[] | string
  'x-enum-comments'?: Record<string, string>
  default?: unknown
  maxLength?: number
  minLength?: number
  maximum?: number
  minimum?: number
  pattern?: string
}

export interface Parameter extends Omit<Schema, 'required'> {
  name: string
  in: string
  required?: boolean
  schema?: Schema
}

export interface Operation {
  operationId?: string
  summary: string
  deprecated?: boolean
  description?: string
  tags?: string[]
  security?: Record<string, string[]>[]
  parameters?: Parameter[]
  responses: Record<string, { description?: string; schema?: Schema }>
  'x-api-operation'?: string
  'x-api-action'?: { name: string; path?: string; version?: string }
  'x-api-lifecycle'?: { stage: 'sunset'; description?: string }
}

export function operationLifecycle(operation: Operation): 'active' | 'deprecated' | 'sunset' {
  if (operation['x-api-lifecycle']?.stage === 'sunset') return 'sunset'
  return operation.deprecated ? 'deprecated' : 'active'
}

export interface SecurityScheme {
  type: string
  name?: string
  in?: string
  description?: string
  flow?: string
  authorizationUrl?: string
  tokenUrl?: string
  scopes?: Record<string, string>
}

export interface Specification {
  swagger: string
  host?: string
  schemes?: string[]
  basePath?: string
  info: { title: string; version: string; description?: string }
  paths: Record<string, Record<string, Operation>>
  definitions: Record<string, Schema>
  securityDefinitions?: Record<string, SecurityScheme>
  security?: Record<string, string[]>[]
  'x-api-actions'?: { path: string; method: string; action: string; version: string; operation: Operation }[]
}

export interface APIOperation {
  key: string
  method: string
  path: string
  runtimePath: string
  action: string
  operation: Operation
  protocol: 'rest' | 'innertop'
  actionVersion?: string
}

/** Slash-separated contract tags are directory paths, independent of runtime routing. */
export function operationGroup(api: APIOperation): string[] {
  return (api.operation.tags?.[0] || 'API').split('/').filter(Boolean)
}

export function formatGroupLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export interface APIGroup {
  key: string
  label: string
  count: number
  children: APIGroup[]
  operations: APIOperation[]
}

export function catalogGroups(catalog: APIOperation[]): APIGroup[] {
  const roots: APIGroup[] = []
  for (const api of catalog) {
    const path = operationGroup(api)
    let siblings = roots
    let key = ''
    for (const [index, label] of path.entries()) {
      key += '/' + label
      let group = siblings.find((entry) => entry.key === key)
      if (!group) {
        group = { key, label: formatGroupLabel(label), count: 0, children: [], operations: [] }
        siblings.push(group)
      }
      group.count++
      if (index === path.length - 1) group.operations.push(api)
      siblings = group.children
    }
  }
  return roots
}

export function enumValues(
  schema: Pick<Schema, 'enum' | 'x-enum-varnames' | 'x-enum-descriptions' | 'x-enum-comments'>,
): { value: unknown; name?: string; description?: string }[] {
  // goswag emits arrays for typed constants and strings for struct-tag extensions.
  const descriptions = schema['x-enum-descriptions']
  const labels = typeof descriptions === 'string' ? descriptions.split('|') : descriptions
  return (schema.enum ?? []).map((value, index) => {
    const name = schema['x-enum-varnames']?.[index]
    return { value, name, description: labels?.[index] || (name ? schema['x-enum-comments']?.[name] : undefined) }
  })
}

export function operations(spec: Specification): APIOperation[] {
  const rest: APIOperation[] = Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.entries(methods)
      .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method))
      .map(([method, operation]) => {
        const actionParameter = operation.parameters?.find(
          (parameter) => parameter.in === 'query' && parameter.name === 'Action',
        )
        const action = actionParameter?.enum?.length === 1 ? String(actionParameter.enum[0]) : ''
        const runtimePath = action && path.endsWith(`/${action}`) ? path.slice(0, -action.length - 1) : path
        return {
          key: `${method.toUpperCase()} ${path}`,
          method: method.toUpperCase(),
          path,
          runtimePath,
          action,
          operation,
          protocol: action ? 'innertop' : 'rest',
        }
      }),
  )
  const actions: APIOperation[] = (spec['x-api-actions'] ?? []).map((entry) => ({
    key: `${entry.operation.operationId} ${entry.version}`,
    method: entry.method.toUpperCase(),
    path: entry.path,
    runtimePath: entry.path,
    action: entry.action,
    actionVersion: entry.version,
    operation: entry.operation,
    protocol: 'innertop',
  }))
  return [...rest, ...actions]
}

/** allOf refines fields; replacing the map loses envelope field descriptions. */
function mergeProperties(left: Schema['properties'], right: Schema['properties']): Schema['properties'] {
  const result = { ...left }
  for (const [name, field] of Object.entries(right ?? {})) {
    result[name] = result[name] ? { allOf: [result[name], field] } : field
  }
  return result
}

/** Resolve composition while retaining nested references for recursive models. */
export function resolveSchema(spec: Specification, schema: Schema, seen = new Set<string>()): Schema {
  let result = { ...schema }
  if (schema.$ref) {
    if (!schema.$ref.startsWith('#/definitions/') || seen.has(schema.$ref))
      throw new Error(`Unresolvable schema: ${schema.$ref}`)
    const definition = spec.definitions[schema.$ref.slice('#/definitions/'.length)]
    if (!definition) throw new Error(`Missing schema: ${schema.$ref}`)
    result = { ...resolveSchema(spec, definition, new Set([...seen, schema.$ref])), ...schema }
    delete result.$ref
  }
  if (schema.allOf) {
    result = schema.allOf.reduce<Schema>((merged, item) => {
      const part = resolveSchema(spec, item, seen)
      return {
        ...merged,
        ...part,
        properties: mergeProperties(merged.properties, part.properties),
        required: [...(merged.required ?? []), ...(part.required ?? [])],
      }
    }, {})
    result = { ...result, ...schema, properties: mergeProperties(result.properties, schema.properties) }
    delete result.allOf
  }
  return result
}

/** Replace only a complete path prefix, leaving unrelated routes intact. */
export function replacePathPrefix(path: string, source: string, target: string): string {
  const from = source.replace(/\/$/, '')
  const to = target.replace(/\/$/, '')
  return path === from || path.startsWith(from + '/') ? (to + path.slice(from.length) || '/') : path
}

export function publicSpecification(
  spec: Specification, origin: string, mapPath: (path: string) => string = path => path,
): Specification {
  const url = new URL(origin)
  const runtimePath = (path: string) => mapPath((spec.basePath ?? '').replace(/\/$/, '') + path)
  const publicOperation = (operation: Operation): Operation => {
    const action = operation['x-api-action']
    return action?.path ? { ...operation, 'x-api-action': { ...action, path: runtimePath(action.path) } } : operation
  }
  return {
    ...spec,
    host: url.host,
    schemes: [url.protocol.slice(0, -1)],
    basePath: '/',
    paths: Object.fromEntries(Object.entries(spec.paths).map(([path, methods]) => [
      runtimePath(path), Object.fromEntries(Object.entries(methods).map(([method, op]) => [method, publicOperation(op)])),
    ])),
    ...(spec['x-api-actions'] ? {
      'x-api-actions': spec['x-api-actions'].map(entry => ({ ...entry, path: runtimePath(entry.path), operation: publicOperation(entry.operation) })),
    } : {}),
  }
}

/** Action routing joins the operation name with a dash-free version. */
export function actionIdentity(api: APIOperation): { name: string; version: string } | undefined {
  if (api.actionVersion) return { name: api.action, version: api.actionVersion }
  if (!api.operation.parameters?.some((parameter) => parameter.in === 'query' && parameter.name === 'Version')) return
  const match = api.action.match(/^(.*)([0-9]{4})([0-9]{2})([0-9]{2})$/)
  if (!match) return
  const version = match.slice(2).join('-')
  const date = new Date(version)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== version) return
  return { name: match[1], version }
}

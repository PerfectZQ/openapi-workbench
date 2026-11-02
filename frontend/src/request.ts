import {
  actionIdentity,
  resolveSchema,
  type APIOperation,
  type Parameter,
  type Schema,
  type Specification,
} from './contract.ts'
import { emptySettings, headerIssue, type Credential, type RequestSettings } from './settings.ts'
import { authorizationRequirements, authorizationTypes, authorizationValues } from './authorization.ts'
import type { AutomaticAuthentication, RequestAdapter } from './host.ts'

export interface RequestDraft {
  values: Record<string, string>
  body: string
  automaticAuth: boolean
  customAuth: boolean
  inheritHeaders: boolean
  actionEncoding: 'combined' | 'split'
  basic?: { username: string; password: string }
  authorization?: { type: string; credential: Credential }
}
export interface PreparedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
  automaticAuth: boolean
  credentials: { in: string; name: string }[]
}

export function supportsAutomaticAuth(
  spec: Specification, api: APIOperation, authentication?: AutomaticAuthentication,
) {
  if (!authentication) return false
  return (
    authorizationRequirements(spec, api).some((schemes) => schemes.includes(authentication.scheme)) ||
    !!api.operation.parameters?.some((parameter) =>
      parameter.in === 'header' && parameter.name.toLowerCase() === authentication.header.toLowerCase(),
    )
  )
}

/** Preview and field state use placeholders; credentials are resolved only when sending. */
export function automaticRequestHeaders(
  spec: Specification, api: APIOperation, draft: RequestDraft, adapter?: RequestAdapter,
) {
  const authentication = adapter?.authentication
  const suppliedHeaders = new Set(
    Object.entries(draft.values)
      .filter(([key, value]) => key.startsWith('header:') && value.trim())
      .map(([key]) => key.slice(7).toLowerCase()),
  )
  const automaticAuth = !!authentication && draft.automaticAuth &&
    supportsAutomaticAuth(spec, api, authentication) &&
    ![authentication.header, ...(authentication.alternativeHeaders ?? [])].some(name => suppliedHeaders.has(name.toLowerCase()))
  const headers = Object.fromEntries(
    Object.entries(adapter?.automaticHeaders?.(api, draft.values) ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  )
  if (automaticAuth && authentication) headers[authentication.header.toLowerCase()] = '<YOUR_TOKEN>'
  return { headers, automaticAuth }
}

export function requestParameters(
  spec: Specification,
  api: APIOperation,
): (Parameter & { authentication?: boolean })[] {
  const parameters = (api.operation.parameters ?? [])
    .filter((parameter) => parameter.in !== 'body')
    .map((parameter) => ({
      ...parameter,
      authentication: parameter.in === 'header' && /token|authorization/i.test(parameter.name),
    }))
  const required = new Set(authorizationRequirements(spec, api).flat())
  for (const type of authorizationTypes(spec).filter((type) => required.has(type.id))) {
    for (const field of type.fields) {
      const existing = parameters.find(
        (parameter) => parameter.in === field.in && parameter.name.toLowerCase() === field.name.toLowerCase(),
      )
      if (existing) {
        existing.authentication = true
        if (type.kind === 'basic') existing.format = 'basic'
      } else
        parameters.push({
          ...field,
          type: 'string',
          format: type.kind === 'basic' ? 'basic' : undefined,
          description: type.id,
          authentication: true,
        })
    }
  }
  return parameters
}

export function schemaExample(spec: Specification, schema: Schema, seen = new Set<string>(), depth = 0): unknown {
  if (depth > 8) return null
  if (schema.$ref && seen.has(schema.$ref)) return null
  const next = new Set(seen)
  if (schema.$ref) next.add(schema.$ref)
  const resolved = resolveSchema(spec, schema)
  if (resolved.example !== undefined) return resolved.example
  if (resolved.default !== undefined) return resolved.default
  if (resolved.enum?.length) return resolved.enum[0]
  if (resolved.type === 'array') return resolved.items ? [schemaExample(spec, resolved.items, next, depth + 1)] : []
  if (resolved.properties)
    return Object.fromEntries(
      Object.entries(resolved.properties).map(([key, value]) => [key, schemaExample(spec, value, next, depth + 1)]),
    )
  if (resolved.type === 'object') return {}
  if (resolved.type === 'integer' || resolved.type === 'number') return resolved.minimum ?? 0
  if (resolved.type === 'boolean') return false
  return ''
}

export function initialDraft(spec: Specification, api: APIOperation, adapter?: RequestAdapter): RequestDraft {
  const body = api.operation.parameters?.find((parameter) => parameter.in === 'body')
  return {
    values: Object.fromEntries(
      requestParameters(spec, api)
        .filter(
          (parameter) =>
            !parameter.authentication &&
            ((parameter.required && parameter.in !== 'header') ||
              parameter.default !== undefined ||
              parameter.enum?.length),
        )
        .map((parameter) => [
          `${parameter.in}:${parameter.name}`,
          String(parameter.default ?? parameter.enum?.[0] ?? ''),
        ]),
    ),
    body: body?.schema ? JSON.stringify(schemaExample(spec, body.schema), null, 2) : '',
    automaticAuth: supportsAutomaticAuth(spec, api, adapter?.authentication),
    customAuth: false,
    inheritHeaders: true,
    actionEncoding: api.protocol === 'innertop' ? 'split' : 'combined',
    basic: requestParameters(spec, api).some((parameter) => parameter.format === 'basic')
      ? { username: '', password: '' }
      : undefined,
  }
}

export class RequestError extends Error {
  code:
    | 'required'
    | 'json'
    | 'sameOrigin'
    | 'basic'
    | 'headerInvalid'
    | 'headerForbidden'
    | 'headerDuplicate'
    | 'authTypeMissing'
  field: string
  constructor(code: RequestError['code'], field = '') {
    super(code)
    this.code = code
    this.field = field
  }
}

/** Shared credentials only apply to schemes declared by this operation. */
export function effectiveDraft(
  spec: Specification,
  api: APIOperation,
  draft: RequestDraft,
  settings: RequestSettings,
  adapter?: RequestAdapter,
): RequestDraft {
  const parameters = requestParameters(spec, api)
  const selected =
    draft.customAuth && draft.authorization
      ? authorizationTypes(spec, settings.customAuthorizations).find((type) => type.id === draft.authorization?.type)
      : undefined
  const values: Record<string, string> = {}
  const isCredential = (name: string) =>
    /token|authorization|cookie/i.test(name) ||
    [...parameters.filter((parameter) => parameter.authentication), ...(selected?.fields ?? [])].some(
      (parameter) => parameter.in === 'header' && parameter.name.toLowerCase() === name.trim().toLowerCase(),
    )
  if (draft.inheritHeaders) {
    for (const header of settings.headers.filter((item) => item.enabled)) {
      if (draft.customAuth && isCredential(header.name)) continue
      const parameter = parameters.find(
        (item) => item.in === 'header' && item.name.toLowerCase() === header.name.trim().toLowerCase(),
      )
      values['header:' + (parameter?.name ?? header.name.trim().toLowerCase())] = header.value
    }
  }
  let basic = draft.customAuth ? draft.basic : undefined
  if (!draft.customAuth) {
    const required = new Set(authorizationRequirements(spec, api).flat())
    for (const type of authorizationTypes(spec).filter((type) => required.has(type.id))) {
      const credential = settings.credentials[type.id]
      if (!credential) continue
      if (type.kind === 'basic') basic = { username: credential.username ?? '', password: credential.password ?? '' }
      else if (credential.value) Object.assign(values, authorizationValues(type, credential))
    }
  }
  for (const [key, value] of Object.entries(draft.values)) {
    if (
      (!draft.customAuth || selected) &&
      parameters.some((parameter) => parameter.authentication && key === parameter.in + ':' + parameter.name)
    )
      continue
    values[key] = value
  }
  if (selected && draft.authorization) {
    const credential = draft.authorization.credential
    basic =
      selected.kind === 'basic'
        ? { username: credential.username ?? '', password: credential.password ?? '' }
        : undefined
    Object.assign(values, authorizationValues(selected, credential))
  }
  return {
    ...draft,
    values,
    basic,
    automaticAuth: selected
      ? selected.id === adapter?.authentication?.scheme && draft.automaticAuth
      : draft.customAuth
        ? draft.automaticAuth
        : settings.automaticAuth,
  }
}

export function prepareRequest(
  spec: Specification,
  api: APIOperation,
  draft: RequestDraft,
  origin: string,
  settings: RequestSettings = emptySettings,
  adapter?: RequestAdapter,
): PreparedRequest {
  const issue = draft.inheritHeaders && headerIssue(settings.headers)
  if (issue) throw new RequestError(issue.code as RequestError['code'], issue.field)
  const selected =
    draft.customAuth && draft.authorization
      ? authorizationTypes(spec, settings.customAuthorizations).find((type) => type.id === draft.authorization?.type)
      : undefined
  if (draft.customAuth && draft.authorization && !selected) throw new RequestError('authTypeMissing')
  draft = effectiveDraft(spec, api, draft, settings, adapter)
  const identity = actionIdentity(api)
  let path = api.runtimePath
  const query = new URLSearchParams()
  const headers: Record<string, string> = { accept: 'application/json' }
  for (const [key, value] of Object.entries(draft.values)) {
    if (key.startsWith('header:') && value) headers[key.slice(7).toLowerCase()] = value
  }
  const automatic = automaticRequestHeaders(spec, api, draft, adapter)
  Object.assign(headers, automatic.headers)
  const parameters = requestParameters(spec, api)
  for (const field of selected?.fields ?? []) {
    if (
      !parameters.some(
        (parameter) => parameter.in === field.in && parameter.name.toLowerCase() === field.name.toLowerCase(),
      )
    )
      parameters.push({ ...field, authentication: true })
  }
  for (const parameter of parameters) {
    if (parameter.in === 'header' && parameter.name.toLowerCase() in automatic.headers) continue
    if (parameter.format === 'basic') continue
    if (identity && parameter.in === 'query' && ['Action', 'Version'].includes(parameter.name)) continue
    const value = draft.values[`${parameter.in}:${parameter.name}`]
    if (parameter.required && !(selected && parameter.authentication) && !value?.trim())
      throw new RequestError('required', parameter.name)
    if (value === undefined || (parameter.in === 'header' && !value)) continue
    if (parameter.in === 'path') path = path.replace(`{${parameter.name}}`, encodeURIComponent(value))
    if (parameter.in === 'query') query.set(parameter.name, value)
    if (parameter.in === 'header') headers[parameter.name.toLowerCase()] = value
  }
  if (api.action) {
    query.set('Action', identity && (api.actionVersion || draft.actionEncoding === 'split') ? identity.name : api.action)
    if (identity && (api.actionVersion || draft.actionEncoding === 'split')) query.set('Version', identity.version)
  }
  if (draft.basic && (draft.basic.username || draft.basic.password)) {
    if (draft.basic.username.includes(':')) throw new RequestError('basic')
    const bytes = new TextEncoder().encode(`${draft.basic.username}:${draft.basic.password}`)
    headers.authorization = `Basic ${btoa(String.fromCharCode(...bytes))}`
  }
  const invalidHeader = headerIssue(
    Object.entries(headers).map(([name, value]) => ({
      id: name,
      name,
      value,
      enabled: true,
      secret: false,
    })),
  )
  if (invalidHeader) throw new RequestError(invalidHeader.code as RequestError['code'], invalidHeader.field)
  const url = new URL(path, origin)
  if (url.origin !== new URL(origin).origin) throw new RequestError('sameOrigin')
  url.search = query.toString()
  const bodyParameter = api.operation.parameters?.find((parameter) => parameter.in === 'body')
  let body: string | undefined
  if (bodyParameter) {
    if (bodyParameter.required && !draft.body.trim()) throw new RequestError('required', bodyParameter.name)
    if (draft.body.trim()) {
      try {
        JSON.parse(draft.body)
      } catch {
        throw new RequestError('json')
      }
      body = draft.body
      headers['content-type'] = 'application/json'
    }
  }
  return {
    url: url.href,
    method: api.method,
    headers,
    body,
    automaticAuth: automatic.automaticAuth,
    credentials: [
      ...requestParameters(spec, api).filter(
        (parameter) => parameter.authentication || parameter.format === 'password',
      ),
      ...(selected?.fields ?? []),
      ...(draft.inheritHeaders
        ? settings.headers
            .filter((header) => header.enabled && header.secret)
            .map((header) => ({ in: 'header', name: header.name.trim().toLowerCase() }))
        : []),
    ],
  }
}

export function requestURL(request: PreparedRequest): string {
  const url = new URL(request.url)
  for (const parameter of request.credentials) {
    if (parameter.in === 'query' && url.searchParams.has(parameter.name))
      url.searchParams.set(parameter.name, '<YOUR_TOKEN>')
  }
  return url.href
}

export function requestCurl(request: PreparedRequest): string {
  const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`
  const headers = request.headers
  return [
    `curl -X ${request.method} ${quote(requestURL(request))}`,
    ...Object.entries(headers).map(
      ([name, value]) =>
        `  -H ${quote(`${name}: ${/token|authorization|cookie/i.test(name) || request.credentials.some((parameter) => parameter.in === 'header' && parameter.name.toLowerCase() === name) ? '<YOUR_TOKEN>' : value}`)}`,
    ),
    ...(request.body ? [`  --data-raw ${quote(request.body)}`] : []),
  ].join(' \\\n')
}

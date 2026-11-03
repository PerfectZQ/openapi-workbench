import type { APIOperation, Specification } from './contract.ts'
import { headerIssue, type Credential, type CustomAuthorization } from './settings.ts'

export interface AuthorizationType {
  id: string
  name: string
  kind: 'basic' | 'bearer' | 'custom'
  fields: { in: string; name: string }[]
  description?: string
  userDefined?: boolean
}

/** Classification follows the wire protocol, never a token's name or header. */
export function authorizationTypes(spec: Specification, custom: CustomAuthorization[] = []): AuthorizationType[] {
  const declared = Object.entries(spec.securityDefinitions ?? {}).map(([id, scheme]): AuthorizationType => ({
    id,
    name: scheme.type === 'basic' ? 'Basic Auth' : id,
    kind: scheme.type === 'basic' ? 'basic' : scheme.type === 'oauth2' ? 'bearer' : 'custom',
    fields:
      scheme.type === 'basic' || scheme.type === 'oauth2'
        ? [{ in: 'header', name: 'Authorization' }]
        : scheme.name
          ? [{ in: scheme.in ?? 'header', name: scheme.name }]
          : [],
    description: scheme.description,
  }))
  return [
    ...(!declared.some((type) => type.kind === 'basic')
      ? [
          {
            id: 'builtin:basic',
            name: 'Basic Auth',
            kind: 'basic' as const,
            fields: [{ in: 'header', name: 'Authorization' }],
          },
        ]
      : []),
    { id: 'builtin:bearer', name: 'Bearer Token', kind: 'bearer', fields: [{ in: 'header', name: 'Authorization' }] },
    ...declared.filter((type) => type.kind !== 'custom'),
    ...declared.filter((type) => type.kind === 'custom'),
    ...custom.map((type): AuthorizationType => ({
      id: type.id,
      name: type.name,
      kind: 'custom',
      userDefined: true,
      fields: type.headers.map((name) => ({ in: 'header', name })),
    })),
  ]
}

export function authorizationRequirements(spec: Specification, api: APIOperation): string[][] {
  return (api.operation.security ?? spec.security ?? []).map((requirement) => Object.keys(requirement))
}

export function authorizationValues(type: AuthorizationType, credential: Credential): Record<string, string> {
  if (type.kind === 'basic') return {}
  if (type.kind === 'bearer') return credential.value ? { 'header:Authorization': `Bearer ${credential.value}` } : {}
  return Object.fromEntries(
    type.fields.map((field) => [
      field.in + ':' + field.name,
      type.userDefined ? (credential.headers?.[field.name] ?? '') : (credential.value ?? ''),
    ]),
  )
}

export function customAuthorizationIssue(spec: Specification, types: CustomAuthorization[]) {
  const names = new Set(authorizationTypes(spec).flatMap((type) => [type.name.toLowerCase(), type.id.toLowerCase()]))
  for (const type of types) {
    const name = type.name.trim().toLowerCase()
    if (!name) return { code: 'authNameRequired', field: '' }
    if (names.has(name)) return { code: 'authNameDuplicate', field: type.name }
    names.add(name)
    if (!type.headers.length) return { code: 'authHeaderRequired', field: type.name }
    const issue = headerIssue(
      type.headers.map((header) => ({
        id: header,
        name: header,
        value: '',
        enabled: true,
        secret: true,
      })),
    )
    if (issue) return issue
  }
}

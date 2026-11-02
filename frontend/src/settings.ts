export interface Credential {
  value?: string
  username?: string
  password?: string
  headers?: Record<string, string>
}

export interface CustomAuthorization {
  id: string
  name: string
  headers: string[]
}

export interface SharedHeader {
  id: string
  name: string
  value: string
  enabled: boolean
  secret: boolean
}

export interface RequestSettings {
  automaticAuth: boolean
  credentials: Record<string, Credential>
  headers: SharedHeader[]
  customAuthorizations: CustomAuthorization[]
}

export const emptySettings: RequestSettings = { automaticAuth: true, credentials: {}, headers: [], customAuthorizations: [] }

export function headerIssue(headers: SharedHeader[]): { code: string; field: string } | undefined {
  const seen = new Set<string>()
  for (const header of headers.filter((item) => item.enabled)) {
    const name = header.name.trim().toLowerCase()
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(name) || /[\r\n\0]/.test(header.value))
      return { code: 'headerInvalid', field: header.name }
    if (
      /^(sec-|proxy-)/.test(name) ||
      /^(accept-charset|accept-encoding|access-control-request-headers|access-control-request-method|connection|content-length|cookie|cookie2|date|dnt|expect|host|keep-alive|origin|referer|te|trailer|transfer-encoding|upgrade|via)$/.test(
        name,
      )
    )
      return { code: 'headerForbidden', field: header.name }
    if (seen.has(name)) return { code: 'headerDuplicate', field: header.name }
    seen.add(name)
  }
}

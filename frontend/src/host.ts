import { publicSpecification, type APIOperation, type Specification } from './contract.ts'
import type { ExportOptions } from './innertop.ts'

export interface AutomaticAuthentication {
  scheme: string
  header: string
  label(): string
  alternativeHeaders?: string[]
  getHeaders(): Promise<Record<string, string>>
  onUnauthorized?(): void
}

export interface RequestAdapter {
  authentication?: AutomaticAuthentication
  automaticHeaders?(api: APIOperation, values: Record<string, string>): Record<string, string>
}

/** The host owns access, public routes and service integration configuration. */
export interface APIWorkbenchHost {
  loadSpecification(): Promise<Specification>
  loadSDK?(language?: 'go' | 'typescript'): Promise<Blob>
  request?: RequestAdapter
  innerTOP?: ExportOptions
}

export interface WorkbenchHostOptions {
  specificationURL: string
  origin: string
  request?: RequestAdapter
  mapPath?(path: string): string
  resourceError?(status: number): Error
}

/** One provider loads the protected contract and authenticates API requests.
 * Session-cookie deployments can omit it; fetch keeps same-origin cookies.
 */
export function createWorkbenchHost(options: WorkbenchHostOptions): APIWorkbenchHost {
  return {
    request: options.request,
    async loadSpecification() {
      const url = new URL(options.specificationURL, options.origin)
      if (url.origin !== new URL(options.origin).origin || url.username || url.password) throw new Error('Swagger must use the application origin')
      const authentication = options.request?.authentication
      const headers = authentication ? await authentication.getHeaders() : undefined
      const response = await fetch(url.href, { headers, credentials: 'same-origin', cache: 'no-store', redirect: 'error' })
      if (response.status === 401) authentication?.onUnauthorized?.()
      if (!response.ok) throw options.resourceError?.(response.status) ?? new Error(`Swagger: HTTP ${response.status}`)
      return publicSpecification(await response.json(), options.origin, options.mapPath)
    },
  }
}

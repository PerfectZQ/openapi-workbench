import type { APIOperation, Specification } from './contract.ts'
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

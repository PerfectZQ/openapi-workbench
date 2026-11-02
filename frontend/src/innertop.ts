import { actionIdentity, operations, replacePathPrefix, resolveSchema, type APIOperation, type Schema, type Specification } from './contract.ts'

export interface ExportRoute {
  Region: string
  BackendType: 'https' | 'http'
  BackendValue: string
  PublicPathPrefix: string
  ZtiBackendType: 'https' | 'http'
}
export interface ExportOptions {
  serviceCode: string
  version: string
  group: string
  groupDescription: string
  allowList: string[]
  qps: number
  timeout: number
  routes: ExportRoute[]
  sourcePathPrefix: string
  transportHeaders: string[]
}

export class ExportError extends Error {
  code: string
  detail: string
  constructor(code: string, detail = '') { super(code); this.code = code; this.detail = detail }
}

function valueString(value: unknown): string {
  if (value === undefined || value === null) return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

interface TemplateParameter {
  Name: string
  Type: number
  ParameterType: { $ref: string }
  Example: string
  Description: string
  IsArray: number
  OpenStatus: number
  SortNumber: number
  IsRequired?: number
  DefaultValue?: string
  ArrayElementMaxCount?: number | null
  IsEnum?: number
  EnumValue?: string
  RegPattern?: string
  MaxLength?: number
  MinLength?: number
  MaxValue?: string
  MinValue?: string
  SplitType?: number
  Location?: number
  LocationMulti?: string
}

interface DataType {
  StructName: string
  StructDesc: string
  SortNumber: number
  Element: (Omit<TemplateParameter, 'Name' | 'Type' | 'Description' | 'SplitType' | 'Location' | 'LocationMulti'> & {
    ElementName: string; ElementType: number; ElementDesc: string
  })[]
}

function schemaReference(schema: Schema): string | undefined {
  return schema.$ref ?? (schema.allOf?.length === 1 ? schemaReference(schema.allOf[0]) : undefined)
}

export function generateInnerTOP(spec: Specification, selected: string[], config: ExportOptions) {
  if (!selected.length) throw new ExportError('selection')
  if (!/^[a-zA-Z][\w-]*$/.test(config.serviceCode) || !/^[a-zA-Z][\w-]*$/.test(config.group)) throw new ExportError('identity')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.version) || Number.isNaN(Date.parse(config.version)) || new Date(config.version).toISOString().slice(0, 10) !== config.version) throw new ExportError('version')
  if (!Number.isInteger(config.qps) || config.qps <= 0 || !Number.isInteger(config.timeout) || config.timeout <= 0) throw new ExportError('limits')
  if (!config.allowList.length || config.allowList.some(value => !/^[\w.-]+$/.test(value))) throw new ExportError('acl')
  if (!config.routes.length || new Set(config.routes.map(route => route.Region)).size !== config.routes.length) throw new ExportError('routes')
  for (const route of config.routes) {
    if (typeof route.Region !== 'string' || typeof route.BackendValue !== 'string' || typeof route.PublicPathPrefix !== 'string' ||
      !['http', 'https'].includes(route.BackendType) || !['http', 'https'].includes(route.ZtiBackendType) ||
      !/^[\w.-]+(?::\d+)?$/.test(route.BackendValue) || !/^\/(?:[\w-]+\/)*[\w-]+$/.test(route.PublicPathPrefix)) throw new ExportError('routes')
  }
  const catalog = operations(spec)
  const actions = new Set<string>()
  const dataTypes = new Map<string, DataType>()
  const typeNames = new Map<string, string>()

  function structure(raw: Schema, schema: Schema, context: string): string {
    // Dynamic maps and unconstrained JSON have no equivalent among the seven
    // InnerTOP types. Never manufacture an empty structure for those fields.
    if (schema.additionalProperties) throw new ExportError('dynamic', context)
    if (!schema.properties) throw new ExportError('type', `${context}: object`)
    const reference = schemaReference(raw)
    const identity = reference ?? context
    const existing = dataTypes.get(identity)
    if (existing) return existing.StructName
    const definition = reference?.replace('#/definitions/', '')
    const base = definition?.split('.').at(-1) ?? context
    let name = base.replace(/[^a-zA-Z0-9_]/g, '_')
    if (typeNames.has(name) && typeNames.get(name) !== identity) name = identity.replace(/[^a-zA-Z0-9_]/g, '_')
    if (typeNames.has(name) && typeNames.get(name) !== identity) throw new ExportError('type', `duplicate structure: ${name}`)
    typeNames.set(name, identity)
    const description = definition ? spec.definitions[definition]?.description : schema.description
    const result: DataType = { StructName: name, StructDesc: description ?? name, SortNumber: 0, Element: [] }
    // Register before walking children so recursive references remain references.
    dataTypes.set(identity, result)
    result.Element = Object.entries(schema.properties).map(([field, child], index) => {
      const { Name, Type, Description, SplitType: _split, Location: _location, LocationMulti: _multi, ...properties } =
        parameter(field, child, index, `${name}_${field}`, !!schema.required?.includes(field))
      return { ElementName: Name, ElementType: Type, ElementDesc: Description, ...properties, OpenStatus: 0, SortNumber: index }
    })
    return name
  }

  function parameter(name: string, raw: Schema, index: number, context: string, required?: boolean): TemplateParameter {
    const schema = resolveSchema(spec, raw)
    const array = schema.type === 'array'
    const elementRaw = array ? schema.items ?? {} : raw
    const element = array ? resolveSchema(spec, elementRaw) : schema
    const type = element.type === 'integer' ? element.format === 'int64' ? 3 : 2
      : element.type === 'number' ? ['float', 'float32'].includes(element.format ?? '') ? 4 : 5
        : ({ string: 1, boolean: 6, object: 7 } as Record<string, number>)[element.type ?? '']
    if (element.type === 'array') throw new ExportError('nestedArray', context)
    if (!type) throw new ExportError('type', `${context}: ${element.type ?? 'any'}`)
    return {
      Name: name, Type: type, ParameterType: { $ref: type === 7 ? structure(elementRaw, element, context) : '' },
      Example: valueString(raw.example ?? schema.example), Description: raw.description ?? schema.description ?? name,
      ...(required === undefined ? {} : {
        IsRequired: required ? 1 : 0, DefaultValue: valueString(schema.default),
        ArrayElementMaxCount: null, IsEnum: element.enum?.length ? 1 : 0, EnumValue: element.enum?.map(valueString).join(',') ?? '',
        RegPattern: schema.pattern ?? '', MaxLength: schema.maxLength ?? 0, MinLength: schema.minLength ?? 0,
        MaxValue: valueString(schema.maximum), MinValue: valueString(schema.minimum), SplitType: 0, Location: 0, LocationMulti: '2',
      }),
      IsArray: array ? 1 : 0, OpenStatus: 1, SortNumber: index + 1,
    }
  }

  function api(item: APIOperation) {
    if (item.protocol !== 'innertop') throw new ExportError('unsupported', item.key)
    if (item.actionVersion && item.actionVersion !== config.version) throw new ExportError('version')
    const suffix = config.version.replaceAll('-', '')
    if (/\d{8}$/.test(item.action) && !item.action.endsWith(suffix)) throw new ExportError('version')
    const action = item.action.endsWith(suffix) ? item.action.slice(0, -suffix.length) : item.action
    if (!action || actions.has(action)) throw new ExportError('duplicate', action)
    actions.add(action)
    const body = item.operation.parameters?.find(p => p.in === 'body')?.schema
    const input = body ? resolveSchema(spec, body) : { properties: {} }
    const extra = item.operation.parameters?.filter(p => p.in !== 'body' && !(p.in === 'query' && ['Action', 'Version'].includes(p.name))) ?? []
    const transportHeaders = new Set(config.transportHeaders.map(name => name.toLowerCase()))
    const parameters = extra.filter(p => !(p.in === 'header' && transportHeaders.has(p.name.toLowerCase())))
    const unsupported = parameters.find(p => !['query', 'formData'].includes(p.in))
    if (unsupported) throw new ExportError('location', `${unsupported.name}: ${unsupported.in}`)
    if (!item.operation.responses['200']?.schema) throw new ExportError('emptyResponse', action)
    const response = resolveSchema(spec, item.operation.responses['200']?.schema ?? {})
    const result = response.properties?.Result
    const output = result ? resolveSchema(spec, result) : response.properties?.ResponseMetadata ? { properties: {} } : response
    if (body && !input.properties) throw new ExportError('body', `${action}: ${input.type ?? 'any'}`)
    if (input.additionalProperties) throw new ExportError('dynamic', `${action}.request`)
    // Empty Result in older annotations is not a known response contract.
    if (result && !output.properties) throw new ExportError('response', `${action}.Result: ${output.type ?? 'any'}`)
    if (output.additionalProperties) throw new ExportError('dynamic', `${action}.Result`)
    const requestParameters = [
      ...Object.entries(input.properties ?? {}).map(([name, schema], index) => parameter(name, schema, index, `${action}.request.${name}`, !!input.required?.includes(name))),
      ...parameters.map(({ required, ...p }, index) => ({ ...parameter(p.name, p.schema ?? p, Object.keys(input.properties ?? {}).length + index, `${action}.${p.in}.${p.name}`, !!required), LocationMulti: p.in === 'query' ? '0' : '1' })),
    ]
    const responseParameters = Object.entries(output.properties ?? {}).map(([name, schema], index) => parameter(name, schema, index, `${action}.Result.${name}`))
    if (!actionIdentity(item)?.version) throw new ExportError('versionRoute', item.action)
    return {
      Action: action, NameCn: item.operation.summary, OperationType: 11,
      Description: item.operation.description || item.operation.summary,
      IsDataIntensive: 1, Timeout: config.timeout, FlowControlUnit: 0, QpsLimit: 0,
      ServiceAccessControl: { AllowSelfToAccess: 0, SelfLimitValue: 0, SelfLimitUnit: 0, AllowOtherToAccess: 0, OtherList: [] },
      ServiceACL: { SwitchOn: 1, AllowList: [...new Set(config.allowList)] },
      RateLimit: { FlowControlUnit: 0, QpsConfig: { APITotalLimit: config.qps, ServiceDefaultLimit: 0 } },
      ServiceDefaultLimit: 0, DemoGroup: [], IsBroken: 0, TrailParam: 1, BlockParamList: [], ApiGroup: { $ref: config.group },
      Route: config.routes.map(route => ({
        Region: route.Region, BackendType: route.BackendType, BackendValue: route.BackendValue,
        Path: replacePathPrefix(item.runtimePath, config.sourcePathPrefix, route.PublicPathPrefix),
        ZtiState: 1, ZtiBackendType: route.ZtiBackendType, ZtiBackendValue: route.BackendValue,
        RetryState: 0, ConditionRoutes: [],
      })),
      RequestParameters: requestParameters,
      ResponseParameters: responseParameters,
      CommonErrorCode: [],
      ApiErrorCode: [{ ErrorCode: 'Error', ErrorMessage: 'Error', ErrorDescription: '内部错误', HttpCode: 500, Solution: '', SortNumber: 999 }],
    }
  }
  return {
    TemplateVersion: '1.0.0', TemplateType: 'inner', ServiceCode: config.serviceCode, Version: config.version,
    ApiList: [...new Set(selected)].map(key => {
      const item = catalog.find(item => item.key === key)
      if (!item) throw new ExportError('unsupported', key)
      return api(item)
    }),
    ApiGroup: [{ Name: config.group, Description: config.groupDescription, OpenStatus: 1, SortNumber: 0 }],
    DataType: [...dataTypes.values()].sort((a, b) => a.StructName.localeCompare(b.StructName, 'en')).map((value, index) => ({ ...value, SortNumber: index })), CommonErrorCode: [],
  }
}

// Use the same validation as the downloaded template so the picker never promises
// an export that will silently omit part of an operation.
export function innerTOPExportIssue(spec: Specification, key: string, config: ExportOptions): ExportError | undefined {
  try { generateInnerTOP(spec, [key], config) }
  catch (cause) { return cause instanceof ExportError ? cause : new ExportError('schema') }
}

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { operations, publicSpecification, replacePathPrefix, initialDraft, prepareRequest, requestCurl, emptySettings, generateInnerTOP, innerTOPExportIssue } from '@api-explorer/react/core'

const operation = {
  summary: 'Read inventory',
  'x-api-action': { name: 'ListItems', path: '/actions', version: '2026-10-22' },
  security: [{ SessionKey: [] }],
  parameters: [{ in: 'header', name: 'X-Session-Key', required: true, type: 'string' }],
  responses: { 200: { schema: { type: 'object', properties: { Count: { type: 'integer' } } } } },
}
const inventory = {
  swagger: '2.0', info: { title: 'Inventory API', version: '1' }, basePath: '/inventory',
  paths: { '/items': { get: operation } }, definitions: {},
  securityDefinitions: { SessionKey: { type: 'apiKey', in: 'header', name: 'X-Session-Key' } },
  'x-api-actions': [{ path: '/actions', method: 'post', action: 'ListItems', version: '2026-10-22', operation }],
}

test('自动认证仅在显式注入后启用，手填凭证保持优先', () => {
  const spec = publicSpecification(inventory, 'https://inventory.test')
  const api = operations(spec)[0]
  const draft = initialDraft(spec, api)
  assert.equal(draft.automaticAuth, false)
  assert.throws(() => prepareRequest(spec, api, draft, 'https://inventory.test'), error => error.code === 'required')
  let tokenRequests = 0
  const adapter = {
    authentication: {
      scheme: 'SessionKey', header: 'X-Session-Key', alternativeHeaders: ['X-Partner-Key'],
      label: () => 'Use current session',
      async getHeaders() { tokenRequests++; return { 'X-Session-Key': 'session-secret' } },
    },
    automaticHeaders: () => ({ 'X-Request-Clock': '2026-10-22T12:00:00Z' }),
  }
  const automatic = initialDraft(spec, api, adapter)
  let request = prepareRequest(spec, api, automatic, 'https://inventory.test', emptySettings, adapter)
  assert.equal(request.automaticAuth, true)
  assert.equal(request.url, 'https://inventory.test/inventory/items')
  assert.equal(request.headers['x-session-key'], '<YOUR_TOKEN>')
  assert.equal(request.headers['x-request-clock'], '2026-10-22T12:00:00Z')
  assert.equal(tokenRequests, 0, '生成示例不能取票')
  automatic.customAuth = true
  automatic.values['header:X-Session-Key'] = 'manual-secret'
  request = prepareRequest(spec, api, automatic, 'https://inventory.test', emptySettings, adapter)
  assert.equal(request.automaticAuth, false)
  assert.equal(request.headers['x-session-key'], 'manual-secret')
  assert.ok(!requestCurl(request).includes('manual-secret'))
  const optional = { ...api, operation: { ...operation, parameters: [] } }
  delete automatic.values['header:X-Session-Key']
  automatic.values['header:X-Partner-Key'] = 'partner-secret'
  assert.equal(prepareRequest(spec, optional, automatic, 'https://inventory.test', emptySettings, adapter).automaticAuth, false)
  const publicAPI = { ...optional, operation: { ...optional.operation, security: [] } }
  assert.equal(prepareRequest(spec, publicAPI, initialDraft(spec, publicAPI, adapter), 'https://inventory.test', emptySettings, adapter).automaticAuth, false)
  assert.throws(() => prepareRequest(spec, { ...api, runtimePath: 'https://foreign.test/' }, initialDraft(spec, api, adapter), 'https://inventory.test', emptySettings, adapter), error => error.code === 'sameOrigin')
})

test('公共路径同时映射 REST 与 Action，InnerTOP 完全使用传入服务和区域配置', () => {
  const spec = publicSpecification(inventory, 'https://inventory.test', path => replacePathPrefix(path, '/inventory', '/gateway/stock'))
  assert.ok(spec.paths['/gateway/stock/items'])
  assert.equal(spec['x-api-actions'][0].path, '/gateway/stock/actions')
  assert.equal(spec.paths['/gateway/stock/items'].get['x-api-action'].path, '/gateway/stock/actions')
  assert.equal(spec['x-api-actions'][0].operation['x-api-action'].path, '/gateway/stock/actions')
  assert.equal(inventory.paths['/items'].get['x-api-action'].path, '/actions')
  assert.equal(inventory['x-api-actions'][0].path, '/actions', '不得修改输入契约')
  assert.equal(replacePathPrefix('/inventory-other/items', '/inventory', '/gateway/stock'), '/inventory-other/items')
  const action = operations(spec).find(api => api.action)
  const config = {
    serviceCode: 'inventory', group: 'stock', groupDescription: 'Inventory operations', version: '2026-10-22',
    allowList: ['fulfillment'], qps: 25, timeout: 2000,
    sourcePathPrefix: '/gateway/stock', transportHeaders: ['X-Session-Key'],
    routes: [{ Region: 'test-region', BackendType: 'https', BackendValue: 'stock.internal', PublicPathPrefix: '/services/stock', ZtiBackendType: 'http' }],
  }
  const result = generateInnerTOP(spec, [action.key], config)
  assert.equal(result.ServiceCode, 'inventory')
  assert.deepEqual(result.ApiList[0].ServiceACL.AllowList, ['fulfillment'])
  assert.equal(result.ApiList[0].Route[0].Path, '/services/stock/actions')
  assert.equal(result.ApiList[0].Route[0].BackendValue, 'stock.internal')
  assert.equal(innerTOPExportIssue(spec, action.key, config), undefined)
  assert.equal(innerTOPExportIssue(spec, action.key, { ...config, transportHeaders: [] }).code, 'location')
})

test('标准认证宿主共用一个提供方，保护契约同源并区分 401/403', async t => {
  const { createWorkbenchHost, authorizationTypes } = await import('@api-explorer/react/core')
  const calls = []
  let status = 200, logins = 0, unauthorized = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify(inventory), { status })
  })
  const authentication = {
    scheme: 'SessionKey', header: 'X-Session-Key', label: () => 'Session',
    getHeaders: async () => { logins++; return { 'X-Session-Key': 'session-token' } },
    onUnauthorized: () => { unauthorized++ },
  }
  const host = createWorkbenchHost({ specificationURL: '/swagger.json', origin: 'https://inventory.test', request: { authentication } })
  const spec = await host.loadSpecification()
  assert.ok(spec.paths['/inventory/items'])
  assert.deepEqual(calls[0], { url: 'https://inventory.test/swagger.json', options: {
    headers: { 'X-Session-Key': 'session-token' }, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
  } })
  assert.equal(host.request.authentication, authentication)
  status = 401
  await assert.rejects(host.loadSpecification(), /401/)
  assert.equal(unauthorized, 1)
  status = 403
  await assert.rejects(host.loadSpecification(), /403/)
  assert.equal(unauthorized, 1)
  await assert.rejects(createWorkbenchHost({ specificationURL: 'https://foreign.test/swagger.json', origin: 'https://inventory.test', request: { authentication } }).loadSpecification(), /origin/)
  assert.equal(logins, 3, '跨域契约不能触发取票，401/403 不能重试')
  const oauth = { ...inventory, securityDefinitions: { OAuth: { type: 'oauth2', flow: 'accessCode', scopes: { read: 'Read' } } }, paths: { '/items': { get: { ...operation, parameters: [], security: [{ OAuth: ['read'] }] } } } }
  const api = operations(oauth)[0]
  const settings = { ...emptySettings, credentials: { OAuth: { value: 'oauth-secret' } } }
  assert.equal(authorizationTypes(oauth).find(type => type.id === 'OAuth').kind, 'bearer')
  const request = prepareRequest(oauth, api, initialDraft(oauth, api), 'https://inventory.test', settings)
  assert.equal(request.headers.authorization, 'Bearer oauth-secret')
  assert.ok(!requestCurl(request).includes('oauth-secret'))
  const alternatives = { ...oauth, securityDefinitions: { ...oauth.securityDefinitions, Key: { type: 'apiKey', in: 'header', name: 'X-Key' } } }
  const orAPI = { ...api, operation: { ...api.operation, security: [{ OAuth: ['read'] }, { Key: [] }] } }
  const both = { ...settings, credentials: { ...settings.credentials, Key: { value: 'extra-key' } } }
  const one = prepareRequest(alternatives, orAPI, initialDraft(alternatives, orAPI), 'https://inventory.test', both)
  assert.equal(one.headers.authorization, 'Bearer oauth-secret')
  assert.equal(one.headers['x-key'], undefined, 'OR 不得同时发送不相关的凭据')
  const automaticOAuth = { authentication: { ...authentication, scheme: 'OAuth', header: 'Authorization' } }
  const manualKey = { ...emptySettings, credentials: { Key: { value: 'manual-key' } } }
  const manual = prepareRequest(alternatives, orAPI, initialDraft(alternatives, orAPI, automaticOAuth), 'https://inventory.test', manualKey, automaticOAuth)
  assert.equal(manual.automaticAuth, false, '完整手填组合优先于自动身份')
  assert.equal(manual.headers.authorization, undefined)
  assert.equal(manual.headers['x-key'], 'manual-key')
  const optional = { ...orAPI, operation: { ...orAPI.operation, security: [{}, { OAuth: ['read'] }] } }
  assert.equal(prepareRequest(alternatives, optional, initialDraft(alternatives, optional), 'https://inventory.test', both).headers.authorization, undefined)
  const andAPI = { ...orAPI, operation: { ...orAPI.operation, security: [{ OAuth: ['read'], Key: [] }] } }
  const incomplete = prepareRequest(alternatives, andAPI, initialDraft(alternatives, andAPI), 'https://inventory.test', settings)
  assert.equal(incomplete.headers.authorization, undefined, '不应用不完整的 AND 凭据组合')
})

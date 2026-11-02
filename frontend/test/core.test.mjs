import assert from 'node:assert/strict'
import { test } from 'node:test'
import { operations, publicSpecification, replacePathPrefix, initialDraft, prepareRequest, requestCurl, emptySettings, generateInnerTOP, innerTOPExportIssue } from '@api-explorer/react/core'

const operation = {
  summary: 'Read inventory',
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

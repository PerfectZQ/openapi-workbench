import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { APIWorkbench, type APIWorkbenchHost, type Locale } from '@api-explorer/react'
import '@api-explorer/react/style.css'

const host: APIWorkbenchHost = {
  async loadSpecification() {
    return {
      swagger: '2.0', info: { title: 'Inventory API', version: '1.0' }, definitions: {},
      host: window.location.host, schemes: [window.location.protocol.slice(0, -1)], basePath: '/',
      paths: {
        '/inventory/items': { get: {
          operationId: 'ListItems', summary: 'List inventory items', tags: ['Inventory'],
          responses: { '200': { description: 'Items', schema: { type: 'object', properties: { count: { type: 'integer' } } } } },
        } },
        '/inventory/preview': { post: {
          operationId: 'PreviewItem', summary: 'Preview an item', tags: ['Inventory'],
          parameters: [{ name: 'body', in: 'body', required: true, schema: { type: 'object', properties: { name: { type: 'string', example: 'Notebook' } } } }],
          responses: { '200': { description: 'Preview only; no data is saved', schema: { type: 'object', properties: { name: { type: 'string' } } } } },
        } },
      },
    }
  },
}

function Demo() {
  const [locale, setLocale] = useState<Locale>('en-US')
  return <APIWorkbench host={host} locale={locale} headerActions={
    <select aria-label="Language" value={locale} onChange={event => setLocale(event.target.value as Locale)}>
      <option value="en-US">English</option><option value="zh-CN">简体中文</option>
    </select>
  } />
}

createRoot(document.getElementById('root')!).render(<Demo />)

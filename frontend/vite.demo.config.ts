import { defineConfig, type Connect } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const demoAPI: Connect.NextHandleFunction = (request, response, next) => {
  if (!request.url?.startsWith('/inventory/')) return next()
  response.setHeader('Content-Type', 'application/json')
  if (request.method === 'GET' && request.url === '/inventory/items') return void response.end('{"count":7}')
  if (request.method === 'POST' && request.url === '/inventory/preview') {
    let body = ''
    request.on('data', chunk => { body += chunk })
    request.on('end', () => response.end(body || '{}'))
    return
  }
  response.statusCode = 404
  response.end('{"error":"Unknown demo operation"}')
}

export default defineConfig({
  root: fileURLToPath(new URL('./demo', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react(), {
    name: 'inventory-demo',
    configureServer(server) { server.middlewares.use(demoAPI) },
    configurePreviewServer(server) { server.middlewares.use(demoAPI) },
  }],
  build: { outDir: '../dist-demo', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5194 },
})

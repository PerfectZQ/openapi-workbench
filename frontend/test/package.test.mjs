import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const { build } = createRequire(new URL('../package.json', import.meta.url))('vite')

test('API 文档独立包构建只依赖通用 UI 与第三方库', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '')
  const result = await build({ root, configFile: `${root}/vite.config.ts`, logLevel: 'silent', build: { write: false } })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output)
  const modules = outputs.filter(item => item.type === 'chunk').flatMap(chunk => Object.keys(chunk.modules))
  assert.ok(modules.some(id => id.endsWith('/packages/ui/dist/code-editor/JSONEditor.js')))
  assert.ok(modules.some(id => id === `${root}/src/locales/en-US.json`))
  for (const id of modules.filter(id => id.startsWith('/'))) {
    assert.ok(id.startsWith(`${root}/`), `独立构建依赖项目目录之外的文件：${id}`)
  }
  assert.ok(outputs.some(item => item.fileName === 'api-explorer.css'))
  assert.ok(outputs.some(item => item.fileName === 'index.js' && item.isEntry))
  const chunks = outputs.filter(item => item.type === 'chunk')
  assert.equal(chunks.length, 1, '编辑器与语言模块随组件入口交付')
  assert.ok(chunks[0].dynamicImports.every(file => file === chunks[0].fileName))
  assert.doesNotMatch(chunks[0].code, /\(\s*["']react(?:-dom|\/[^"']*)?["']\s*\)/, '浏览器包不能保留对 React 的 CommonJS require')
  const core = await build({ root, mode: 'core', configFile: `${root}/vite.config.ts`, logLevel: 'silent', build: { write: false } })
  const coreChunks = (Array.isArray(core) ? core : [core]).flatMap(bundle => bundle.output).filter(item => item.type === 'chunk')
  assert.equal(coreChunks.length, 1)
  assert.equal(coreChunks[0].fileName, 'core.js')
  assert.deepEqual(coreChunks[0].imports, [], '契约入口不加载 React 或编辑器')
})

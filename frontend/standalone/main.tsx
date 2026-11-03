import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { APIWorkbench, type APIWorkbenchHost, type Locale } from '../src/index'
import { createWorkbenchHost } from '../src/core'
import '../src/swagger.css'

const host: APIWorkbenchHost = {
  async loadSpecification() {
    const config = await fetch('./api-explorer.json', { redirect: 'error' })
    if (!config.ok) throw new Error(`API Explorer configuration: HTTP ${config.status}`)
    const { spec } = await config.json() as { spec: string }
    return createWorkbenchHost({ specificationURL: new URL(spec, window.location.href).href, origin: window.location.origin }).loadSpecification()
  },
}

function Explorer() {
  const [locale, setLocale] = useState<Locale>('zh-CN')
  return <APIWorkbench host={host} locale={locale} headerActions={
    <select aria-label="Language / 语言" value={locale} onChange={event => setLocale(event.target.value as Locale)}>
      <option value="zh-CN">简体中文</option><option value="en-US">English</option>
    </select>
  } />
}
createRoot(document.getElementById('root')!).render(<Explorer />)

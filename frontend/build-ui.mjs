import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname } from 'node:path'

execFileSync('tsc', ['-p', 'tsconfig.ui.json'], { stdio: 'inherit' })
for (const file of readdirSync('src/ui', { recursive: true }).filter(file => file.endsWith('.css'))) {
  mkdirSync(dirname(`dist/ui/${file}`), { recursive: true })
  cpSync(`src/ui/${file}`, `dist/ui/${file}`)
}

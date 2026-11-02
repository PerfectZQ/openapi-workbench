import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'

rmSync('dist', { recursive: true, force: true })
execFileSync('tsc', ['-p', 'tsconfig.json'], { stdio: 'inherit' })
for (const file of readdirSync('src', { recursive: true }).filter(file => file.endsWith('.css'))) {
  mkdirSync(dirname(`dist/${file}`), { recursive: true })
  cpSync(`src/${file}`, `dist/${file}`)
}

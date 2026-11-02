import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { esmExternalRequirePlugin } from 'rolldown/plugins'

export default defineConfig(({ mode }) => ({
  plugins: [react(), esmExternalRequirePlugin({ external: [/^(react|react-dom)(\/|$)/] })],
  build: {
    emptyOutDir: mode !== 'core',
    lib: {
      entry: mode === 'core' ? 'src/core.ts' : 'entry.ts',
      fileName: mode === 'core' ? 'core' : 'index', formats: ['es'], cssFileName: 'api-explorer',
    },
    rolldownOptions: {
      output: { codeSplitting: false },
    },
  },
}))

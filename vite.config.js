import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = process.env.VERCEL ? '/' : env.VITE_BASE_PATH || '/'
  return {
    plugins: [react()],
    base,
  }
})

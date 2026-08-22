import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = process.env.VERCEL
    ? '/'
    : process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || '/'
  return {
    plugins: [react()],
    base,
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // SparkJS ships pre-bundled web workers; don't let Vite pre-optimize it
  // or the splat-parsing worker fails silently in dev mode.
  optimizeDeps: {
    exclude: ['@sparkjsdev/spark'],
  },
})

import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { dealDiscussionsPlugin } from './server/features/deal-discussions/index.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dealDiscussionsPlugin()],
  input: {
    main: fileURLToPath(new URL('./index.html', import.meta.url)),
    deal: fileURLToPath(new URL('./deal.html', import.meta.url)),
  },
  build: { manifest: true },
})

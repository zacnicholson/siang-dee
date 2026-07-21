import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    rolldownOptions: {
      output: {
        // Put transformers.js in its own chunk so it only loads on demand
        manualChunks(id) {
          if (id.includes('@huggingface/transformers') || id.includes('onnx')) {
            return 'transformers'
          }
        },
      },
    },
  },
})

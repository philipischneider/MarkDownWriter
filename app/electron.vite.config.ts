import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['electron'],
        output: {
          format: 'cjs'
        }
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        external: ['electron'],
        output: {
          format: 'cjs'
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: './src/client/index.jsx',
      formats: ['es'],
      fileName: 'client',
    },
    outDir: 'public/js',
    minify: true,
    rollupOptions: {
      external: [],
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'hono/jsx/dom',
  },
})

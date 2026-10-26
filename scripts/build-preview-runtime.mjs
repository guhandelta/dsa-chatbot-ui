// Builds public/preview/react-runtime.js: React and ReactDOM as one classic
// script for the sandboxed playground preview. Runs before dev and build.
import { build } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

await build({
  root,
  configFile: false,
  logLevel: 'warn',
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'public/preview',
    emptyOutDir: true,
    copyPublicDir: false,
    minify: true,
    lib: {
      entry: 'src/preview-runtime/react-runtime.ts',
      formats: ['iife'],
      name: 'DsaPreviewReact',
      fileName: () => 'react-runtime.js',
    },
  },
})

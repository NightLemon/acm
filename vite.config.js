import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site under /<repo>/, so assets need that prefix.
// BASE_PATH is set by the deploy workflow; local dev and `vite preview` use '/'.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5180, open: true, host: true },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@codemirror/lang-cpp') || id.includes('node_modules/@lezer/cpp')) return 'codemirror-cpp';
          if (id.includes('node_modules/@codemirror/lang-python') || id.includes('node_modules/@lezer/python')) return 'codemirror-python';
          if (id.includes('node_modules/@codemirror/') || id.includes('node_modules/@lezer/') || id.includes('node_modules/@uiw/')) return 'codemirror-core';
          return undefined;
        },
      },
    },
  },
});

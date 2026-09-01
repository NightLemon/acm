import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site under /<repo>/, so assets need that prefix.
// BASE_PATH is set by the deploy workflow; local dev and `vite preview` use '/'.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5180, open: true, host: true },
  build: { outDir: 'dist' },
});

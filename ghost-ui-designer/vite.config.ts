import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';

// Renderer (React) + procesos main/preload de Electron.
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: { build: { outDir: 'dist-electron', rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].js' } } } },
      },
      {
        entry: 'electron/preload.ts',
        onstart: (args) => args.reload(),
        vite: { build: { outDir: 'dist-electron', rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].js' } } } },
      },
    ]),
  ],
  build: { outDir: 'dist' },
});

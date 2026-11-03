import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      {
        name: 'gh-pages-raw-fallback',
        transformIndexHtml: {
          order: 'pre',
          handler(html) {
            return html
              .replace(/<link id="gh-pages-css"[^>]*>\s*/g, '')
              .replace(
                /<script id="gh-pages-js"[^>]*><\/script>/g,
                '<script type="module" src="/src/main.tsx"></script>'
              );
          },
        },
        closeBundle() {
          try {
            const assetsDir = path.resolve(__dirname, 'dist/assets');
            const outDir = path.resolve(__dirname, 'public/gh-pages');
            if (!fs.existsSync(assetsDir)) return;
            fs.mkdirSync(outDir, { recursive: true });
            const files = fs.readdirSync(assetsDir);
            const jsFile = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
            const cssFile = files.find((f) => f.startsWith('index-') && f.endsWith('.css'));
            if (jsFile) fs.copyFileSync(path.join(assetsDir, jsFile), path.join(outDir, 'app.js'));
            if (cssFile) fs.copyFileSync(path.join(assetsDir, cssFile), path.join(outDir, 'app.css'));
          } catch {
            // Ignore copy errors in read-only environments
          }
        },
      },
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStaticGame(mountPath: string, dirName: string): Plugin {
  const gameDir = path.resolve(__dirname, `public/${dirName}`);
  return {
    name: `serve-${dirName}`,
    configureServer(server) {
      // Runs BEFORE Vite's own transform middleware — JS/HTML files won't be mangled
      server.middlewares.use(`/${mountPath}`, (req, res, next) => {
        const rawUrl = req.url ?? '/';
        const url = rawUrl.split('?')[0];
        const filePath = path.join(gameDir, url === '/' ? 'index.html' : url);
        // Path traversal guard
        if (!filePath.startsWith(gameDir)) return next();
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          const idx = path.join(filePath, 'index.html');
          if (!fs.existsSync(idx)) return next();
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.end(fs.readFileSync(idx));
        }
        const ext = path.extname(filePath);
        res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
        res.end(fs.readFileSync(filePath));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveStaticGame('polytrack', 'polytrack'), serveStaticGame('eaglercraft', 'eaglercraft'), serveStaticGame('watermelon', 'watermelon')],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});

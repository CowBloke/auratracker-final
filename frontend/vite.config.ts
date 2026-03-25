import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const MIME: Record<string, string> = {
  '.js': 'application/javascript',
  '.html': 'text/html',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.flac': 'audio/flac',
  '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary',
  '.track': 'text/plain',
};

function serveStatic(prefix: string, dir: string) {
  return {
    name: `serve-static-${prefix.replace(/\//g, '')}`,
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url: string = req.url ?? '';
        if (!url.startsWith(prefix)) return next();
        const rel = url.slice(prefix.length).split('?')[0];
        const filePath = path.join(dir, rel);
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return next();
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    serveStatic('/polytrack/', path.resolve(__dirname, 'public/polytrack')),
  ],
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

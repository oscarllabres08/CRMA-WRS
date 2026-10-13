import type { IncomingMessage } from 'node:http';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function rememberOrigin(req: IncomingMessage, save: (origin: string) => void) {
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
  const host = (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader)?.split(',')[0]?.trim();
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = ((Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) || 'http').split(',')[0].trim();
  if (host) save(`${proto}://${host}`);
}

function linkPreview(): Plugin {
  let requestOrigin = '';
  const configuredOrigin = () =>
    (process.env.VITE_SITE_URL || process.env.URL || '').trim().replace(/\/$/, '');

  const withAbsoluteImage = (html: string) => {
    const origin = configuredOrigin() || requestOrigin;
    if (!origin) return html;
    return html.replaceAll('content="/crma-logo.png"', `content="${origin}/crma-logo.png"`);
  };

  return {
    name: 'crma-link-preview',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rememberOrigin(req, (origin) => {
          requestOrigin = origin;
        });
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rememberOrigin(req, (origin) => {
          requestOrigin = origin;
        });
        next();
      });
    },
    transformIndexHtml(html) {
      return withAbsoluteImage(html);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), linkPreview()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});

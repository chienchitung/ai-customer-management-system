/// <reference types="vitest/config" />
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createRoutes } from './server/routes';
import { configFromEnv } from './server/config';

// Serves the same /api routes as the Vercel functions during `vite dev` / `vite preview`,
// so secrets (Gemini, Google, Supabase service role) only ever live server-side.
const apiPlugin = (env: Record<string, string>): Plugin => {
  const routes = createRoutes(configFromEnv({ ...process.env, ...env }));
  const mount = (middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void }) =>
    middlewares.use((req, res, next) => {
      const handler = routes[(req.url ?? '').split('?')[0]];
      if (handler) void handler(req, res);
      else next();
    });
  return {
    name: 'api-routes',
    configureServer(server) { mount(server.middlewares); },
    configurePreviewServer(server) { mount(server.middlewares); },
  };
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), apiPlugin(env)],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      test: {
        environment: 'node',
      },
    };
});

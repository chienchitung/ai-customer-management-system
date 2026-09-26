/// <reference types="vitest/config" />
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createAIHandler } from './server/aiProxy';

// Serves POST /api/ai from the dev and preview servers so the Gemini key
// only lives server-side.
const aiProxyPlugin = (apiKey: string | undefined): Plugin => {
  const handler = createAIHandler(apiKey);
  return {
    name: 'ai-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai', (req, res) => { void handler(req, res); });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/ai', (req, res) => { void handler(req, res); });
    },
  };
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), aiProxyPlugin(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY)],
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

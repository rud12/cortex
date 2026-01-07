import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs'
import path from 'path'

export default defineConfig(({ mode }) => {
  const proxyRule = (port, prefix, ws = false) => ({
    target: `https://127.0.0.1:${port}`,
    changeOrigin: true,
    secure: false,
    ws,
    rewrite: (pathValue) => pathValue.replace(new RegExp(`^${prefix}`), '')
  });

  return {
    plugins: [ react() ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      https: {
        key: fs.readFileSync(path.resolve(__dirname, 'cert/key.pem')),
        cert: fs.readFileSync(path.resolve(__dirname, 'cert/cert.pem'))
      },
      proxy: {
        '/svc/auth': proxyRule(3001, '/svc/auth'),
        '/svc/inventory': proxyRule(3002, '/svc/inventory', true),
        '/svc/pos': proxyRule(3003, '/svc/pos'),
        '/svc/vision': proxyRule(3004, '/svc/vision', true),
        '/svc/forecast': proxyRule(3005, '/svc/forecast'),
        '/svc/chat': proxyRule(3006, '/svc/chat')
      }
    }
  };
});

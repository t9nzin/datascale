import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'fedora.tail39b3f6.ts.net'
    ],
    port: 5174,
    proxy: {
      // Forward all /api calls to the main dataTail server
      '/api': 'http://127.0.0.1:3000',
    },
  },
});

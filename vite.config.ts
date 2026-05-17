import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error — plain JS plugin, no type defs
import { liveRefresh } from './scripts/vite-live-refresh.mjs';

export default defineConfig({
  plugins: [react(), liveRefresh()],
  server: { port: 5173, strictPort: false },
});

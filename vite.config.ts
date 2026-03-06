import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [solid()],
  server: {
    port: 3000
  },
  build: {
    target: 'esnext'
  }
});

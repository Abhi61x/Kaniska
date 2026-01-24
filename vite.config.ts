
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // CRITICAL: Define process.env for browser compatibility
  define: {
    'process.env': process.env
  },
  // CRITICAL FOR CAPACITOR: 
  // Makes paths relative (e.g., "./assets/index.js") instead of absolute ("/assets/index.js").
  base: './', 
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});

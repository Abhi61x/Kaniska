
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // CRITICAL: Define process.env for browser compatibility
  define: {
    'process.env': process.env,
    // Explicitly inject API_KEY to prevent "process is not defined" error in Gemini SDK
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || "")
  },
  base: './', 
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    host: true
  }
});

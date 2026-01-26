import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // CRITICAL FOR CAPACITOR: 
  // Makes paths relative (e.g., "./assets/index.js") instead of absolute ("/assets/index.js").
  // Without this, the Android app cannot find the JavaScript files and shows a black screen.
  base: './', 
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
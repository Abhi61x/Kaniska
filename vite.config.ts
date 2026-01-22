import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // FIX: Cast process to any to avoid 'Property cwd does not exist on type Process' error
  // FIX: Use process.cwd() instead of __dirname which is not available in ESM context
  const currentDir = (process as any).cwd();

  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, currentDir, '');

  return {
    plugins: [react()],
    // CRITICAL FOR CAPACITOR: 
    // Makes paths relative (e.g., "./assets/index.js") instead of absolute ("/assets/index.js").
    // Without this, the Android app cannot find the JavaScript files and shows a black screen.
    base: './', 
    resolve: {
      alias: {
        '@': path.resolve(currentDir, './'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    define: {
      // Define process.env.API_KEY so it can be used in the app code
      // We prioritize VITE_GEMINI_API_KEY from .env, but also fallback to API_KEY if set system-wide
      // Fallback to empty string to prevent "Uncaught ReferenceError" or undefined in code
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.API_KEY || ''),
    }
  };
});
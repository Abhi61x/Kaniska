
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './src/App.tsx';
import { TranslationProvider } from './i18n/index.tsx';

// Immediate initialization for modules
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Critical Error: Could not find root element to mount to");
} else {
  // Global Error Handler for Vercel/Native Debugging
  window.onerror = function(message, source, lineno, colno, error) {
      console.error("App Crash Detected:", message);
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:black;color:red;z-index:9999;padding:20px;font-family:monospace;overflow:auto;";
      errorDiv.innerHTML = `
        <h2 style="color:white">App Initialization Error</h2>
        <p><strong>Message:</strong> ${message}</p>
        <p><strong>Location:</strong> ${source}:${lineno}</p>
        <hr style="border-color: #333"/>
        <p style="color:gray;font-size:12px">Check if VITE_YOUTUBE_API_KEY and API_KEY are set in Vercel Dashboard.</p>
      `;
      document.body.appendChild(errorDiv);
  };

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(
        TranslationProvider,
        null,
        React.createElement(App, null)
      )
    )
  );
}

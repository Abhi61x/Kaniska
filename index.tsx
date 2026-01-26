import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './src/App.tsx';
import { TranslationProvider } from './i18n/index.tsx';

window.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  // GLOBAL ERROR HANDLER FOR ANDROID WEBVIEW
  // This catches errors like "process is not defined" and shows them on screen 
  // instead of leaving the user with a confusing black screen.
  window.onerror = function(message, source, lineno, colno, error) {
      const errorDiv = document.createElement('div');
      errorDiv.style.position = 'fixed';
      errorDiv.style.top = '0';
      errorDiv.style.left = '0';
      errorDiv.style.width = '100%';
      errorDiv.style.height = '100%';
      errorDiv.style.backgroundColor = 'black';
      errorDiv.style.color = 'red';
      errorDiv.style.zIndex = '9999';
      errorDiv.style.padding = '20px';
      errorDiv.style.fontFamily = 'monospace';
      errorDiv.innerHTML = `
        <h2 style="color:white">App Crash (Kaniska)</h2>
        <p><strong>Error:</strong> ${message}</p>
        <p><strong>Source:</strong> ${source}</p>
        <p><strong>Line:</strong> ${lineno}</p>
        <hr/>
        <p style="color:gray">Please verify 'process.env' is removed from all files.</p>
      `;
      document.body.appendChild(errorDiv);
  };

  const root = ReactDOM.createRoot(rootElement);
  // FIX: Converted JSX to React.createElement to bypass potential tooling issues with parsing children, which could cause the "Property 'children' is missing" error.
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
});
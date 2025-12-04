import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './src/App.tsx';
import { TranslationProvider } from './i18n/index.tsx';

window.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

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
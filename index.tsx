

import React from 'react';
import ReactDOM from 'react-dom/client';
// --- FIX START: Update import path for App component ---
import { App } from './App.tsx';
// --- FIX END: Update import path for App component ---

window.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
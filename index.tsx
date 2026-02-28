import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

window.addEventListener('error', (e) => {
  console.error('[Global Error]', e.message, e.error);
  alert(`__FATAL_ERROR__: ${e.message}\n\nStack: ${e.error?.stack}`);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Unhandled Rejection]', e.reason);
  alert(`__FATAL_REJECTION__: ${e.reason}\n\nStack: ${e.reason?.stack}`);
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
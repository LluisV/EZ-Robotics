import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { setupMonacoEnvironment } from './utils/setupMonaco';

// Initialize Monaco environment before rendering the app
setupMonacoEnvironment();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
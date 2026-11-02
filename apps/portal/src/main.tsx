import '@tenantry/ui/styles.scss';
import './app.scss';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App.js';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App hostname={window.location.hostname} />
    </BrowserRouter>
  </StrictMode>,
);

import './styles.css';
// The pages not yet moved off Carbon (Home, Projects, not found) still need the legacy sheet; Task 12 removes it.
import '@tenantry/ui/styles.scss';
import './app.scss';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Root } from './Root.js';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>,
);

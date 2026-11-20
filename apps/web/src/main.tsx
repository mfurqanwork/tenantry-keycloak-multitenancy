import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { startAnalytics } from '@tenantry/app-kit';
import { Root } from './Root.js';

// Cookieless product analytics (app-kit analytics.ts); off when the build has no key.
startAnalytics(import.meta.env['VITE_POSTHOG_KEY'] as string | undefined);

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>,
);

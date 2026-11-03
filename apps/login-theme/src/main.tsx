import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KcPage } from './kc.gen.js';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

// Keycloak puts kcContext on window when it renders a page; `pnpm dev` alone has none.
createRoot(root).render(
  <StrictMode>
    {window.kcContext ? <KcPage kcContext={window.kcContext} /> : <h1>No Keycloak context</h1>}
  </StrictMode>,
);

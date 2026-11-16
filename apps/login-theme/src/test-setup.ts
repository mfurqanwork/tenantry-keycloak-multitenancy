import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// Keycloakify loads each page lazily; under a full parallel run that takes longer than the default 1 s wait.
configure({ asyncUtilTimeout: 5000 });

// jsdom lacks matchMedia and ResizeObserver, which the theme provider reads. Defined, not stubbed: the
// brand tests undo their own fetch stubs with unstubAllGlobals, which would take matchMedia too.
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
globalThis.ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};

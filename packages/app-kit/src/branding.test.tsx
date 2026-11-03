import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider, type Api } from './api.js';
import { useBranding } from './branding.js';

afterEach(() => {
  document.body.removeAttribute('style');
});

function api(answer: unknown): Api {
  return {
    get: vi.fn(() => Promise.resolve(answer)),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
    upload: vi.fn(),
  } as unknown as Api;
}

function Show() {
  const { branding: brand } = useBranding('acme');
  return <p>{brand ? `brand ${brand.name}` : 'no brand'}</p>;
}

describe('useBranding', () => {
  it("applies the workspace's colour to the page and clears it when it goes", async () => {
    const { unmount } = render(
      <ApiProvider api={api({ name: 'Acme', primaryColor: '#0f62fe', logoUrl: null })}>
        <Show />
      </ApiProvider>,
    );
    expect(await screen.findByText('brand Acme')).toBeInTheDocument();
    await waitFor(() => {
      expect(document.body.style.getPropertyValue('--cds-button-primary')).toBe('#0f62fe');
    });
    unmount();
    expect(document.body.style.getPropertyValue('--cds-button-primary')).toBe('');
  });

  it("leaves Carbon's colours without one", async () => {
    render(
      <ApiProvider api={api({ name: 'Acme', primaryColor: null, logoUrl: null })}>
        <Show />
      </ApiProvider>,
    );
    await screen.findByText('brand Acme');
    expect(document.body.style.getPropertyValue('--cds-button-primary')).toBe('');
  });
});

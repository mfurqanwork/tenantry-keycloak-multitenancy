import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TechLogo } from './tech-logo.js';

describe('TechLogo', () => {
  it('draws a known technology as a named image', () => {
    render(<TechLogo name="keycloak" />);
    const logo = screen.getByRole('img', { name: 'Keycloak' });
    expect(logo.tagName.toLowerCase()).toBe('svg');
    expect(logo).toHaveAttribute('fill', 'currentColor');
  });

  it('writes the name where there is no glyph', () => {
    render(<TechLogo name="entra" />);
    expect(screen.getByText('Microsoft Entra ID')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('withLabel shows the glyph and the name', () => {
    render(<TechLogo name="postgresql" withLabel />);
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    // The visible name labels it, so the glyph itself is not announced twice.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('decorative hides the glyph beside text that already names it', () => {
    render(
      <button type="button">
        <TechLogo name="keycloak" decorative />
        Give console access
      </button>,
    );
    expect(screen.getByRole('button', { name: 'Give console access' })).toBeInTheDocument();
    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('takes a size', () => {
    render(<TechLogo name="docker" size={24} />);
    expect(screen.getByRole('img', { name: 'Docker' })).toHaveAttribute('width', '24');
  });
});

import {
  siDocker,
  siGithub,
  siKeycloak,
  siNestjs,
  siOkta,
  siOpenid,
  siPostgresql,
  siReact,
  type SimpleIcon,
} from 'simple-icons';
import { cn } from '../lib/cn.js';

export type TechName =
  | 'keycloak'
  | 'docker'
  | 'postgresql'
  | 'openid'
  | 'okta'
  | 'github'
  | 'react'
  | 'nestjs'
  | 'entra'
  | 'scim';

// Glyphs from Simple Icons (CC0). Microsoft Entra ID and SCIM have none there, so they show their name.
const TECH: Record<TechName, { label: string; icon?: SimpleIcon }> = {
  keycloak: { label: 'Keycloak', icon: siKeycloak },
  docker: { label: 'Docker', icon: siDocker },
  postgresql: { label: 'PostgreSQL', icon: siPostgresql },
  openid: { label: 'OpenID Connect', icon: siOpenid },
  okta: { label: 'Okta', icon: siOkta },
  github: { label: 'GitHub', icon: siGithub },
  react: { label: 'React', icon: siReact },
  nestjs: { label: 'NestJS', icon: siNestjs },
  entra: { label: 'Microsoft Entra ID' },
  scim: { label: 'SCIM' },
};

/**
 * A technology's logo, in one colour (`currentColor`) so it suits both themes. Alone it is an image named
 * after the technology; with `withLabel` the name is written after it and the glyph is decorative.
 */
export function TechLogo({
  name,
  size = 16,
  withLabel = false,
  className,
}: {
  name: TechName;
  size?: number;
  withLabel?: boolean;
  className?: string;
}) {
  const { label, icon } = TECH[name];
  if (!icon) {
    return <span className={cn('text-sm font-medium', className)}>{label}</span>;
  }
  const glyph = (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={cn('shrink-0', !withLabel && className)}
      {...(withLabel ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      <path d={icon.path} />
    </svg>
  );
  if (!withLabel) return glyph;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', className)}>
      {glyph}
      {label}
    </span>
  );
}

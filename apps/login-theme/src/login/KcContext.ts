import type { ExtendKcContext } from 'keycloakify/login';
import type { ThemeName } from '../kc.gen.js';

export interface KcContextExtension {
  themeName: ThemeName;
  properties: Record<string, string | undefined>;
}

// Keycloakify's extension points; this theme adds no per-page fields.
// eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type
export type KcContext = ExtendKcContext<KcContextExtension, Record<never, never>>;

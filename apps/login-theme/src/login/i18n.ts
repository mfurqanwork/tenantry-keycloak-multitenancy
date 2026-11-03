import { i18nBuilder } from 'keycloakify/login';
import type { ThemeName } from '../kc.gen.js';

// ofTypeI18n exists only to carry the type, as Keycloakify documents.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { useI18n, ofTypeI18n } = i18nBuilder.withThemeName<ThemeName>().build();

export type I18n = typeof ofTypeI18n;
export { useI18n };

export type LogoType = 'image/png' | 'image/jpeg' | 'image/webp';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

const startsWith = (bytes: Buffer, prefix: number[], at = 0) =>
  bytes.length >= at + prefix.length && prefix.every((b, i) => bytes[at + i] === b);
const ascii = (s: string) => Array.from(Buffer.from(s, 'latin1'));

// The type comes from the file's own first bytes, never from the name or the client's content type,
// so an SVG or HTML file cannot be served from our origin as a logo.
export function sniffImageType(bytes: Buffer): LogoType | null {
  if (startsWith(bytes, PNG)) return 'image/png';
  if (startsWith(bytes, JPEG)) return 'image/jpeg';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp';
  return null;
}

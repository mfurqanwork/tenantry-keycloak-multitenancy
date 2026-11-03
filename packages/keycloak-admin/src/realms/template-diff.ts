export interface TemplateDiff {
  path: string;
  live: unknown;
  template: unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Keycloak answers some numbers and booleans as strings (attributes, SMTP port): compare their text.
type Primitive = string | number | boolean;
const isPrimitive = (v: unknown): v is Primitive =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
const samePrimitive = (a: unknown, b: unknown) =>
  a === b || (isPrimitive(a) && isPrimitive(b) && String(a) === String(b));

// Does `live` hold everything `template` sets? Keys the template leaves out are Keycloak's to choose.
function covers(template: unknown, live: unknown): boolean {
  if (isObject(template)) {
    return isObject(live) && Object.entries(template).every(([k, v]) => covers(v, live[k]));
  }
  if (Array.isArray(template)) {
    if (!Array.isArray(live) || live.length !== template.length) return false;
    // Plain strings (redirect URIs, roles) are a set; objects (policy profiles) keep their order.
    if (template.every((t) => typeof t === 'string') && live.every((l) => typeof l === 'string')) {
      const want = [...template].sort();
      const have = [...live].sort();
      return want.every((t, i) => t === have[i]);
    }
    return template.every((t, i) => covers(t, live[i]));
  }
  return samePrimitive(template, live);
}

// What upgrading would change: one entry per templated key (objects recursively; arrays as wholes)
// whose live value differs. Used for the dry run and to decide whether an upgrade has work to do.
export function diffTemplate(template: object, live: object, prefix = ''): TemplateDiff[] {
  const out: TemplateDiff[] = [];
  for (const [key, want] of Object.entries(template)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const have = (live as Record<string, unknown>)[key];
    if (isObject(want) && isObject(have)) out.push(...diffTemplate(want, have, path));
    else if (!covers(want, have)) out.push({ path, live: have, template: want });
  }
  return out;
}

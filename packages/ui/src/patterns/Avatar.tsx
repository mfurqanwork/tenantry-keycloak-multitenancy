// A person as their initials on a neutral circle: the first letters of their first two words, or the first
// two letters of an email or one-word name.
export function initials(name: string): string {
  const base = name.includes('@') ? (name.split('@')[0] ?? '') : name;
  const words = base.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const [first, second] = words;
  const letters = second ? `${first?.[0] ?? ''}${second[0] ?? ''}` : (first ?? '').slice(0, 2);
  return letters.toUpperCase();
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span className={`tenantry-avatar tenantry-avatar--${size}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

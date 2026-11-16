import { cn } from '../lib/cn.js';

// A person as their initials: the first letters of their first two words, or the first two letters of an
// email or one-word name.
export function initials(name: string): string {
  const base = name.includes('@') ? (name.split('@')[0] ?? '') : name;
  const words = base.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const [first, second] = words;
  const letters = second ? `${first?.[0] ?? ''}${second[0] ?? ''}` : (first ?? '').slice(0, 2);
  return letters.toUpperCase();
}

/** A person's picture, or their initials on a soft tile. Decorative: the name is always written beside it. */
export function Avatar({ name, src, size = 'md' }: { name: string; src?: string | null; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-6 text-[0.625rem]' : 'size-8 text-xs';
  if (src) return <img src={src} alt="" aria-hidden="true" className={cn('shrink-0 rounded-full object-cover', box)} />;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary-subtle font-medium text-foreground',
        box,
      )}
    >
      {initials(name)}
    </span>
  );
}

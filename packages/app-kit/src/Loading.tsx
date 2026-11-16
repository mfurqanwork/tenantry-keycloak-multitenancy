import { LoaderCircle } from 'lucide-react';

// A small spinner with what is loading, announced politely.
export function Loading({ description }: { description: string }) {
  return (
    <p role="status" className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      {description}
    </p>
  );
}

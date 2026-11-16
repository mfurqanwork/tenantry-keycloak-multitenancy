import { Button, Popover, PopoverContent, PopoverTrigger, type IconComponent } from '@tenantry/ui';
import { Bell, Building2, Clock, Mail, ShieldCheck, User, Users } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { ApiErrorNotification } from '../ApiErrorNotification.js';
import { useApi } from '../api.js';
import { Loading } from '../Loading.js';
import type { Workspace } from '../workspaces.js';

export interface NotificationLink {
  app: 'web' | 'admin';
  path: string;
  workspace?: string;
}

export interface NotificationItem {
  id: string;
  kind: 'you' | 'team' | 'workspace' | 'security' | 'expiring' | 'invite';
  title: string;
  body: string;
  link: NotificationLink;
  createdAt: string;
  unread: boolean;
}

interface Feed {
  items: NotificationItem[];
  unread: number;
}

const ICONS: Record<NotificationItem['kind'], IconComponent> = {
  you: User,
  team: Users,
  workspace: Building2,
  security: ShieldCheck,
  expiring: Clock,
  invite: Mail,
};

const REFRESH_MS = 60_000;

// A notification's address: this workspace's Tenantry or Admin, or another workspace's Tenantry.
export function linkHref(link: NotificationLink, workspaces: Workspace[]): string | null {
  const here = workspaces.find((w) => w.current);
  if (!here) return null;
  if (link.workspace) {
    const url = new URL(here.webUrl);
    url.hostname = url.hostname.replace(/^[^.]+/, link.workspace);
    return new URL(link.path, url).toString();
  }
  return new URL(link.path, link.app === 'admin' ? here.portalUrl : here.webUrl).toString();
}

// "5 min ago", "3 h ago", "2 days ago".
export function timeAgo(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${String(minutes)} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)} h ago`;
  const days = Math.floor(hours / 24);
  return `${String(days)} ${days === 1 ? 'day' : 'days'} ago`;
}

// The bell in the top bar (spec 8.4): an unread count, the latest notifications, and "Mark all as read".
// It refreshes every minute while the page is visible.
export function NotificationsBell({
  workspaces,
  now = () => new Date(),
}: {
  workspaces: Workspace[];
  now?: () => Date;
}) {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    api.get<Feed>('/api/notifications').then(
      (data) => {
        setFeed(data);
        setError(null);
      },
      (err: unknown) => {
        setError(err);
      },
    );
  }, [api]);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [load]);

  const unread = feed?.unread ?? 0;
  const markAllRead = () => {
    void api.post('/api/notifications/read', {}).then(
      () => {
        setFeed((f) => (f ? { unread: 0, items: f.items.map((i) => ({ ...i, unread: false })) } : f));
      },
      (err: unknown) => {
        setError(err);
      },
    );
  };

  // Entries with no address (no current workspace to build one from) are left out rather than linked to "#".
  const entries = (feed?.items ?? []).flatMap((item) => {
    const href = linkHref(item.link, workspaces);
    return href ? [{ item, href }] : [];
  });

  // A panel, not a menu (Review Focus 3): a screen reader reads its heading, status text and unread marks in
  // order, which a menu's item-to-item movement skips.
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${String(unread)} unread` : 'Notifications'}
        >
          <Bell aria-hidden="true" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] leading-none font-semibold text-primary-foreground"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-labelledby={headingId} align="end" className="max-h-[28rem] w-[min(22rem,calc(100vw-2rem))]">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <h2 id={headingId} className="text-sm font-semibold">
            Notifications
          </h2>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="text-link" onClick={markAllRead}>
              Mark all as read
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-1 p-1">
          {error !== null && (
            <div className="p-2">
              <ApiErrorNotification error={error} />
            </div>
          )}
          {!feed && !error && <Loading description="Loading notifications" />}
          {feed && entries.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          )}
          {entries.length > 0 && (
            <ul className="flex flex-col gap-1">
              {entries.map(({ item, href }) => {
                const Icon = ICONS[item.kind];
                return (
                  <li key={item.id} data-unread={item.unread ? 'true' : 'false'}>
                    <a
                      href={href}
                      className="focus-ring flex items-start gap-3 rounded-md px-2 py-2 text-sm outline-none hover:bg-accent"
                    >
                      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-medium text-foreground">{item.title}</span>
                        {item.body && <span className="text-muted-foreground">{item.body}</span>}
                        <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt, now())}</span>
                      </span>
                      {item.unread && (
                        <>
                          <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                          <span className="sr-only">Unread</span>
                        </>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

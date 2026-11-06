import { Button, HeaderGlobalAction, HeaderPanel, InlineLoading } from '@carbon/react';
import {
  Email,
  Enterprise,
  Notification as BellIcon,
  NotificationNew,
  Security,
  Time,
  User,
  UserMultiple,
  type CarbonIconType,
} from '@carbon/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiErrorNotification } from '../ApiErrorNotification.js';
import { useApi } from '../api.js';
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

const ICONS: Record<NotificationItem['kind'], CarbonIconType> = {
  you: User,
  team: UserMultiple,
  workspace: Enterprise,
  security: Security,
  expiring: Time,
  invite: Email,
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

// The bell in the header (spec 8.4): an unread count, the latest notifications, and "Mark all as read".
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

  return (
    <>
      <HeaderGlobalAction
        aria-label={unread > 0 ? `Notifications, ${String(unread)} unread` : 'Notifications'}
        aria-expanded={open}
        isActive={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {unread > 0 ? (
          <span className="tenantry-bell">
            <NotificationNew size={20} />
            <span className="tenantry-bell__count" aria-hidden="true">
              {unread > 9 ? '9+' : unread}
            </span>
          </span>
        ) : (
          <BellIcon size={20} />
        )}
      </HeaderGlobalAction>
      <HeaderPanel aria-label="Notifications" expanded={open} className="tenantry-notifications">
        <section aria-label="Notifications" className="tenantry-notifications__body">
          <div className="tenantry-notifications__header">
            <h2 className="tenantry-notifications__title">Notifications</h2>
            {unread > 0 && (
              <Button kind="ghost" size="sm" onClick={markAllRead}>
                Mark all as read
              </Button>
            )}
          </div>
          <ApiErrorNotification error={error} />
          {!feed && !error && <InlineLoading description="Loading notifications" />}
          {feed?.items.length === 0 && (
            <p className="tenantry-notifications__empty">You&apos;re all caught up.</p>
          )}
          <ul className="tenantry-notifications__list">
            {feed?.items.map((item) => {
              const Icon = ICONS[item.kind];
              const href = linkHref(item.link, workspaces);
              return (
                <li key={item.id} data-unread={item.unread ? 'true' : 'false'}>
                  <a className="tenantry-notifications__item" href={href ?? '#'}>
                    <Icon size={20} aria-hidden="true" className="tenantry-notifications__icon" />
                    <span className="tenantry-notifications__text">
                      <span className="tenantry-notifications__item-title">{item.title}</span>
                      {item.body && <span className="tenantry-notifications__item-body">{item.body}</span>}
                      <span className="tenantry-notifications__time">{timeAgo(item.createdAt, now())}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      </HeaderPanel>
    </>
  );
}

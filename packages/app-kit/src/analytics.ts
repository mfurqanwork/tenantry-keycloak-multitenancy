import { posthog, type CaptureResult } from 'posthog-js/dist/module.slim.no-external.js';

// Product analytics (PostHog EU), set up to need no consent banner:
// - no cookies or storage: ids live in memory for one page load;
// - events go to /api/ingest on the app's own host (the API relays them), so the CSP stays 'self';
// - no autocapture, recordings, surveys, flags or scripts loaded from PostHog;
// - Do Not Track and Global Privacy Control are honoured;
// - URLs lose their query and hash (sign-in codes, states), except utm_* campaign tags.
// Signed-in people are identified by their user id only, never their email or name.
// The key is baked in at build time (VITE_POSTHOG_KEY); without one nothing starts.

const URL_PROPS = [
  '$current_url',
  '$pathname',
  '$referrer',
  '$initial_referrer',
  '$initial_current_url',
  '$initial_pathname',
  '$prev_pageview_pathname',
  '$session_entry_url',
  '$session_entry_pathname',
  '$session_entry_referrer',
];
const UTM = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']);
const RELATIVE = 'http://relative.invalid';

// A URL or path without its secrets: no query except utm_* tags, and no hash.
export function cleanUrl(value: string): string {
  if (value === '$direct') return value;
  let url: URL;
  try {
    url = new URL(value, RELATIVE);
  } catch {
    return value;
  }
  const kept = [...url.searchParams].filter(([k]) => UTM.has(k));
  const query = kept.length ? `?${new URLSearchParams(kept).toString()}` : '';
  return `${url.origin === RELATIVE ? '' : url.origin}${url.pathname}${query}`;
}

function cleanProps(props: Record<string, unknown> | undefined): void {
  if (!props) return;
  for (const k of URL_PROPS) {
    const v = props[k];
    if (typeof v === 'string') props[k] = cleanUrl(v);
  }
}

export function cleanEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  cleanProps(event.properties);
  cleanProps(event.$set);
  cleanProps(event.$set_once);
  return event;
}

let started = false;
let pendingUser: string | undefined;

function optedOut(): boolean {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  return n.globalPrivacyControl === true || n.doNotTrack === '1';
}

export function startAnalytics(key: string | undefined): void {
  if (started || !key || optedOut()) return;
  started = true;
  posthog.init(key, {
    api_host: '/api/ingest',
    ui_host: 'https://eu.posthog.com',
    persistence: 'memory',
    person_profiles: 'identified_only',
    capture_pageview: 'history_change',
    capture_pageleave: true,
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_exceptions: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    advanced_disable_flags: true,
    disable_external_dependency_loading: true,
    respect_dnt: true,
    before_send: cleanEvent,
  });
  if (pendingUser) identifyUser(pendingUser);
}

// Joins this visit to the signed-in person (by id only). Safe to call on every render.
export function identifyUser(userId: string): void {
  pendingUser = userId;
  if (!started || posthog.get_distinct_id() === userId) return;
  posthog.identify(userId);
}

// Before signing out: the next events belong to a new anonymous visitor.
export function forgetUser(): void {
  pendingUser = undefined;
  if (started) posthog.reset();
}

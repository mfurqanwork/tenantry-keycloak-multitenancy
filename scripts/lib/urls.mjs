// Where to start once the stack is up: the welcome page on the base domain (Phase 6a).
export function welcomeUrl(port, baseDomain = 'tenantry.localhost') {
  return `http://${baseDomain}${port === 80 ? '' : `:${port}`}`;
}

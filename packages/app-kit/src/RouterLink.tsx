import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { Link } from 'react-router';

// The shell's links pass href; the router's Link wants to. Lets AppShell navigate without a page load.
export const RouterLink = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>(function RouterLink({ href, ...rest }, ref) {
  return <Link ref={ref} to={href} {...rest} />;
});

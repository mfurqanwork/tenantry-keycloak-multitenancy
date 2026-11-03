import { createContext, useContext, type ElementType } from 'react';

// The app's router link, set once by AppShell (`linkAs`), so page patterns link the same way the side
// nav does. Null outside a shell, or in an app without a router: plain anchors then.
export const LinkContext = createContext<ElementType | null>(null);

export const useRouterLink = (): ElementType | null => useContext(LinkContext);

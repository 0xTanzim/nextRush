'use client';

import { useEffect } from 'react';

/**
 * When a mental-model concept stop (an in-page anchor) is clicked, briefly
 * flash-highlights the target section so the jump is obvious. Uses a document
 * click listener (delegation) so it works regardless of mount order, and is
 * disabled entirely for reduced-motion users.
 */
export function ScrollHighlight() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const handler = (event: Event) => {
      const link = (event.target as HTMLElement)?.closest?.('.mm-flow__link') as
        | HTMLAnchorElement
        | null;
      if (!link) return;
      const id = link.getAttribute('href')?.replace('#', '');
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      window.setTimeout(() => {
        target.classList.add('flash');
        window.setTimeout(() => target.classList.remove('flash'), 1300);
      }, 250);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return null;
}
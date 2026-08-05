'use client';

import { Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';

const DISMISS_KEY = 'nextrush-skills-promo-dismissed';
/** Fired after writing to localStorage so this component re-reads and re-renders. */
const DISMISS_EVENT = 'nextrush-skills-promo-dismiss-changed';

function subscribe(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => window.removeEventListener(DISMISS_EVENT, onChange);
}

/**
 * Hydration-safe localStorage read. Reads real state only after mount (SSR always sees
 * "not dismissed" since localStorage doesn't exist server-side) — same pattern as the
 * mount-detection hook in `site-header.tsx`'s `ThemeToggle`, avoids the
 * `react-hooks/set-state-in-effect` lint rule and a real hydration mismatch. Subscribes
 * to a same-tab custom event (not the native `storage` event, which only fires in OTHER
 * tabs) so clicking dismiss re-renders this component immediately.
 */
function useIsDismissed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(DISMISS_KEY) === 'true',
    () => false
  );
}

/**
 * Dismissible Agent Skills entry in the docs sidebar footer.
 *
 * Was previously a permanent, always-rendered block regardless of how much vertical
 * space the doc tree above it needed — on any expanded section (e.g. "Concepts"), this
 * card still claimed its fixed slot at the bottom, competing with the tree for the
 * user's actual navigation task instead of yielding space to it. Now closable (persisted
 * in localStorage, not just session state) — once dismissed, this card no longer renders
 * for that user, freeing the space permanently rather than just for one page view.
 */
export function SkillsSidebarPromo() {
  const dismissed = useIsDismissed();

  if (dismissed) return null;

  return (
    <div className="relative mb-3 rounded-xl border border-[color-mix(in_srgb,var(--color-fd-border)_90%,transparent)] bg-[color-mix(in_srgb,var(--color-fd-muted)_45%,var(--color-fd-card))] p-3 pe-8 shadow-[inset_0_1px_0_0_hsla(220,20%,100%,0.04)]">
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, 'true');
          window.dispatchEvent(new Event(DISMISS_EVENT));
        }}
        aria-label="Dismiss Agent skills promo"
        className="absolute right-2 top-2 rounded-md p-1 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
      >
        <X className="size-3.5" aria-hidden />
      </button>
      <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wider text-fd-muted-foreground">
        <Sparkles className="size-3.5 shrink-0 text-[var(--learning-context)]" aria-hidden />
        Agent skills
      </div>
      <Link
        href="/skills"
        className="mt-2 block text-sm font-semibold text-fd-foreground transition-colors hover:text-fd-primary"
      >
        Browse skills
      </Link>
      <p className="mt-1 text-xs leading-snug text-fd-muted-foreground">
        Installable guides for AI tools — same content as{' '}
        <Link href="/skills.json" className="font-medium text-fd-primary underline underline-offset-2">
          /skills.json
        </Link>
        .
      </p>
    </div>
  );
}

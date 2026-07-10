'use client';

import { ChevronDown } from 'lucide-react';

/**
 * Version-switcher affordance for the top nav.
 *
 * PLAN.md defers real multi-version routing (branch-based version trees) to a future
 * major release — see "Requirements" #7 in docs/documentation-rebuild/PLAN.md. This is a
 * single-item, disabled control that shows the real current version so the affordance
 * exists in the UI without implying switching actually works yet.
 *
 * `version` is passed as a prop rather than imported from `@/config/appConfig` directly:
 * that module does a `readFileSync` (`node:fs`) at module scope to read the real version
 * from `packages/nextrush/package.json`, which is fine for server components/routes but
 * breaks Turbopack's client bundling when imported into a `'use client'` component like
 * this one — the caller (a server component) resolves the real version and passes it down.
 */
export function VersionSwitcher({ version }: { version: string }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Version switching is planned for a future release — see PLAN.md"
      className="inline-flex items-center gap-1 rounded-md border border-fd-border px-2 py-1 text-xs font-medium text-fd-muted-foreground opacity-70 cursor-not-allowed"
    >
      <span className="hidden sm:inline">v{version}</span>
      <ChevronDown className="size-3" aria-hidden />
    </button>
  );
}

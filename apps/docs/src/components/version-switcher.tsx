import { appConfig } from '@/config/appConfig';
import { ChevronDown } from 'lucide-react';

/**
 * Version-switcher affordance for the top nav.
 *
 * PLAN.md defers real multi-version routing (branch-based version trees) to a future
 * major release — see "Requirements" #7 in docs/documentation-rebuild/PLAN.md. This is a
 * single-item, disabled control that shows the real current version (from
 * `packages/nextrush/package.json` via `appConfig.version`) so the affordance exists in the
 * UI without implying switching actually works yet.
 */
export function VersionSwitcher() {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Version switching is planned for a future release — see PLAN.md"
      className="inline-flex items-center gap-1 rounded-md border border-fd-border px-2 py-1 text-xs font-medium text-fd-muted-foreground opacity-70 cursor-not-allowed"
    >
      v{appConfig.version}
      <ChevronDown className="size-3" aria-hidden />
    </button>
  );
}

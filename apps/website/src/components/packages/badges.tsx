import type { PackageStatus, PackageTypeBadge } from '@/lib/package-registry-types';

// Badge text colors are intentionally distinct from the shared --rush-*
// design tokens: those tokens are tuned for use as plain text on a solid
// page background, but a badge's text sits on its own /12%-opacity tinted
// background. That blend shifts the effective contrast ratio — several
// --rush-* values that read fine as plain text fail WCAG AA (4.5:1) once
// blended: dark blue 4.12:1, light cyan 3.20:1, light green 2.05:1 (badly).
// Confirmed via lighthouse a11y audit + relative-luminance calc against the
// actual blended pixel color, T22 launch hardening. Values below are chosen
// to clear 4.5:1 against the blended background in their respective theme.
const TYPE_BADGE_STYLES: Record<PackageTypeBadge, string> = {
  Core: 'bg-[var(--learning-application)]/12 text-[#BC4E08] dark:text-[var(--color-fd-primary)] ring-1 ring-[var(--learning-application)]/25',
  Middleware: 'bg-[var(--learning-context)]/12 text-[#057088] dark:text-[var(--learning-context)] ring-1 ring-[var(--learning-context)]/25',
  Extension: 'bg-[var(--learning-middleware)]/12 text-[var(--learning-middleware)] ring-1 ring-[var(--learning-middleware)]/25',
  Adapter: 'bg-[var(--learning-runtime)]/12 text-[#166534] dark:text-[var(--learning-runtime)] ring-1 ring-[var(--learning-runtime)]/25',
  // Tool badge uses --text-secondary rather than --color-fd-muted-foreground:
  // the latter is 4.31:1 against --color-fd-secondary in light mode, just
  // under the 4.5:1 WCAG AA minimum (confirmed via lighthouse a11y audit,
  // T22 launch hardening) — --text-secondary clears it comfortably in both
  // themes against the same background.
  Tool: 'bg-fd-secondary text-[var(--text-secondary)] ring-1 ring-fd-border',
};

const STATUS_BADGE_STYLES: Record<PackageStatus, string> = {
  Stable: 'bg-emerald-500/12 text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400',
  New: 'bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-400',
  Deprecated: 'bg-red-500/15 text-red-700 ring-1 ring-red-500/30 dark:text-red-400',
};

export function TypeBadge({ type }: { type: PackageTypeBadge }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${TYPE_BADGE_STYLES[type]}`}
    >
      {type}
    </span>
  );
}

export function StatusBadge({ status }: { status: PackageStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium ${STATUS_BADGE_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

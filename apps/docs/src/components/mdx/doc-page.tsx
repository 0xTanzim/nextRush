import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, ArrowRight, CheckCircle2, Gauge, Globe2, Layers, Package, Puzzle, Sparkles, Zap } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

const highlightIcons: Record<string, LucideIcon> = {
  zap: Zap,
  globe: Globe2,
  code: Sparkles,
  layers: Layers,
  gauge: Gauge,
  package: Package,
  puzzle: Puzzle,
};

/**
 * Hero band for key docs pages. Documentation Mode allows at most one
 * near-invisible brand wash behind a hero (DESIGN.md "Acceptable gradient
 * usage") — not the two full-saturation blur blobs Brand Mode uses; those
 * are removed here (Phase 3 of docs-design-system-rollout).
 */
export function DocHero({ eyebrow, children }: { eyebrow?: string; children: ReactNode }) {
  return (
    <div className="doc-hero not-prose relative mb-10 overflow-hidden rounded-2xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] p-6 md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--brand-wash)_0%,transparent_60%)]"
      />
      <div className="relative z-10">
        {eyebrow ? (
          <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--brand-link)]">
            {eyebrow}
          </p>
        ) : null}
        <div className="text-base leading-relaxed text-[var(--text-secondary)] md:text-lg [&_a]:font-medium [&_a]:text-[var(--brand-link)] [&_a]:underline-offset-4 hover:[&_a]:text-[var(--brand-hover)] [&_strong]:font-semibold [&_strong]:text-[var(--text-primary)]">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline metadata pill for a hero — requirements, runtime support, reading
 * time. Deliberately not an alert/callout: this is page metadata a reader
 * scans in passing, not a warning that demands attention.
 */
export function DocHeroPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_55%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
      {children}
    </span>
  );
}

export function DocStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="doc-stat flex flex-col rounded-xl border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_55%,var(--color-fd-card))] px-4 py-3 transition-colors hover:border-[var(--border-strong)]">
      <span className="text-[0.65rem] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <span className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)] md:text-xl">
        {value}
      </span>
      {hint ? (
        <span className="mt-0.5 text-xs leading-snug text-[var(--text-secondary)]">{hint}</span>
      ) : null}
    </div>
  );
}

export function DocStatStrip({ children }: { children: ReactNode }) {
  return <div className="not-prose my-8 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export type BenchmarkBarItem = {
  label: string;
  value: number;
  detail?: string;
  accent?: 'blue' | 'cyan' | 'purple' | 'green' | 'muted';
};

const benchmarkAccent: Record<NonNullable<BenchmarkBarItem['accent']>, string> = {
  blue: 'from-blue-500 to-cyan-400',
  cyan: 'from-cyan-400 to-emerald-400',
  purple: 'from-violet-500 to-fuchsia-400',
  green: 'from-emerald-400 to-lime-300',
  muted: 'from-slate-500 to-slate-400',
};

export function BenchmarkBars({
  title,
  description,
  items,
  suffix = ' RPS',
  legend,
}: {
  title: string;
  description?: string;
  items: BenchmarkBarItem[];
  suffix?: string;
  /** Shown upper-right; defaults depend on `suffix` (RPS vs relative %). */
  legend?: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  const defaultLegend = suffix.trim() === '%' ? 'larger = bigger gap in this run' : 'higher is better';

  return (
    <section className="not-prose my-8 overflow-hidden rounded-2xl border border-[var(--color-fd-border)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-fd-card)_92%,transparent),color-mix(in_srgb,var(--rush-blue)_8%,var(--color-fd-card)))] p-5 shadow-[0_24px_80px_-48px_color-mix(in_srgb,var(--rush-blue)_45%,transparent)] md:p-6">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] md:text-lg">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {legend ?? defaultLegend}
        </span>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const width = `${Math.max((item.value / max) * 100, 8)}%`;
          const style = { '--benchmark-width': width } as CSSProperties;
          const accent = benchmarkAccent[item.accent ?? 'blue'];

          return (
            <div key={item.label} className="grid gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-[var(--text-primary)]">{item.label}</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {item.value.toLocaleString()}
                  {suffix}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-fd-muted)_70%,transparent)] ring-1 ring-inset ring-[var(--color-fd-border)]">
                <div
                  className={`h-full w-[var(--benchmark-width)] rounded-full bg-gradient-to-r ${accent} shadow-[0_0_24px_color-mix(in_srgb,var(--rush-blue)_22%,transparent)]`}
                  style={style}
                />
              </div>
              {item.detail ? (
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                  {item.detail}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export type BenchmarkCardItem = {
  label: string;
  value: string;
  detail: string;
};

export function BenchmarkCardGrid({ items }: { items: BenchmarkCardItem[] }) {
  return (
    <div className="not-prose my-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="group relative overflow-hidden rounded-2xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] p-5 shadow-[0_1px_0_0_color-mix(in_srgb,white_8%,transparent)] transition-all hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--rush-cyan)_30%,var(--color-fd-border))]"
        >
          <div
            aria-hidden
            className="absolute -right-10 -top-10 size-24 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--rush-cyan)_18%,transparent)_0%,transparent_68%)] transition-transform group-hover:scale-125"
          />
          <p className="relative text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {item.label}
          </p>
          <p className="relative mt-3 font-mono text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
            {item.value}
          </p>
          <p className="relative mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            {item.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CompareGrid({ children }: { children: ReactNode }) {
  // gap-4 (was gap-3) + my-10 (was my-8): breathing room per feedback
  // start1.md #5 "comparison cards feel cramped" — denser cards compete with
  // each other; the grid itself needed more space between members.
  return (
    <div className="not-prose my-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  );
}

export function CompareItem({
  name,
  bestFor,
  tradeoff,
}: {
  name: string;
  /** The one scenario this framework is the strongest pick for. */
  bestFor: string;
  /** The main cost you take on by choosing it, relative to NextRush. */
  tradeoff: string;
}) {
  return (
    // No hover-border, no elevated cursor: these cards are NOT clickable
    // (feedback start1.md #6 — "Cards don't feel clickable"; making hover
    // stronger implies a route that doesn't exist, so we make the rest of
    // the surface flatter instead). p-5 (was p-4) addresses "cramped" (#5).
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] p-5">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{name}</h3>
      <dl className="flex flex-col gap-3 text-sm leading-snug">
        <div className="flex flex-col gap-1">
          <dt className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--accent-success-fg)]">
            <CheckCircle2 className="size-3" strokeWidth={2.5} aria-hidden />
            Best for
          </dt>
          <dd className="text-[0.95rem] font-semibold leading-snug text-[var(--text-primary)]">
            {bestFor}
          </dd>
        </div>
        <div className="flex flex-col gap-1 border-t border-[var(--color-fd-border)] pt-2.5">
          <dt className="flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-[0.1em] text-[var(--status-warning-text)]">
            <AlertTriangle className="size-3" strokeWidth={2.5} aria-hidden />
            Tradeoff
          </dt>
          <dd className="text-[0.8125rem] leading-relaxed text-[var(--text-secondary)]">
            {tradeoff}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function HighlightGrid({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

export function HighlightItem({
  icon,
  title,
  description,
}: {
  icon: keyof typeof highlightIcons;
  title: string;
  description: string;
}) {
  const Icon = highlightIcons[icon] ?? Package;
  return (
    <div className="flex gap-4 rounded-xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] p-4 transition-colors hover:border-[color-mix(in_srgb,var(--rush-purple)_25%,var(--color-fd-border))]">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--rush-blue)_12%,transparent)] text-[var(--rush-blue)] ring-1 ring-[color-mix(in_srgb,var(--rush-blue)_22%,transparent)]">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
      </div>
    </div>
  );
}

const docTableShell =
  'not-prose my-6 overflow-x-auto rounded-xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] shadow-[0_1px_0_0_color-mix(in_srgb,white_6%,transparent)] dark:shadow-[inset_0_1px_0_0_hsla(220,20%,100%,0.04)]';

const docTableInner =
  '[&_table]:m-0 [&_table]:w-full [&_table]:min-w-[min(100%,520px)] [&_table]:border-collapse [&_table]:text-sm [&_caption]:mb-2 [&_caption]:text-left [&_caption]:text-xs [&_caption]:text-[var(--text-muted)] ' +
  '[&_thead]:bg-[color-mix(in_srgb,var(--color-fd-muted)_70%,transparent)] [&_th]:border-b [&_th]:border-[var(--color-fd-border)] [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-[var(--text-primary)] ' +
  '[&_td]:border-b [&_td]:border-[var(--color-fd-border)] [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_td]:text-[var(--text-secondary)] [&_td]:leading-relaxed [&_tbody_tr:last-child_td]:border-b-0 ' +
  '[&_tbody_tr:hover]:bg-[color-mix(in_srgb,var(--color-fd-muted)_35%,transparent)] [&_code]:rounded [&_code]:bg-[color-mix(in_srgb,var(--color-fd-muted)_80%,transparent)] [&_code]:px-1 [&_code]:py-px [&_code]:text-[0.85em] ' +
  '[&_a]:font-medium [&_a]:text-[var(--rush-blue)] [&_a]:underline [&_a]:decoration-[color-mix(in_srgb,var(--rush-blue)_45%,transparent)] [&_a]:underline-offset-2 hover:[&_a]:text-[var(--rush-purple)]';

/**
 * Wraps markdown tables: visible grid lines, header row, hover on body rows, link styling.
 */
export function DocTableWrap({ children }: { children: ReactNode }) {
  return <div className={`${docTableShell} ${docTableInner}`}>{children}</div>;
}

export type DocPageOutlineItem = {
  href: string;
  title: string;
  description: string;
};

/**
 * In-page section map with real links (replaces plain markdown tables for “on this page” lists).
 */
export function DocPageOutline({ items }: { items: DocPageOutlineItem[] }) {
  return (
    <nav aria-label="Sections on this page" className="not-prose my-8">
      <ul className="divide-y divide-[color-mix(in_srgb,var(--color-fd-border)_85%,transparent)] overflow-hidden rounded-xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)]">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="group flex gap-3 px-4 py-3.5 transition-colors hover:bg-[color-mix(in_srgb,var(--color-fd-muted)_45%,var(--color-fd-card))] sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-[var(--text-primary)] group-hover:text-[var(--rush-blue)]">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-sm text-[var(--text-secondary)]">
                  {item.description}
                </span>
              </div>
              <ArrowRight
                className="size-4 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-60"
                aria-hidden
              />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Small uppercase label placed directly above a heading to signal it's
 * subordinate to the section above (supporting detail, not a new primary
 * topic) without dropping the heading level itself — semantic heading
 * structure (h2/h3) stays intact for a11y/outline purposes; this only
 * changes the visual weight a reader perceives before they reach the text.
 */
export function DocSectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="not-prose mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-subtle)]">
      {children}
    </p>
  );
}

export type DocPrerequisiteItem = { label: string; value: string };

/**
 * Compact prerequisite strip (replaces two-column prerequisite tables).
 */
export function DocPrerequisiteGrid({ items }: { items: DocPrerequisiteItem[] }) {
  return (
    <div className="not-prose my-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_40%,var(--color-fd-card))] px-4 py-3.5 shadow-[inset_0_1px_0_0_hsla(220,20%,100%,0.04)]"
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {item.label}
          </p>
          <p className="mt-2 text-sm font-medium leading-snug text-[var(--text-primary)]">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

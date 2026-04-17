import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Gauge, Globe2, Layers, Package, Puzzle, Sparkles, Zap } from 'lucide-react';
import type { ReactNode } from 'react';

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
 * Hero band for key docs pages — gradient border, modern spacing.
 */
export function DocHero({ eyebrow, children }: { eyebrow?: string; children: ReactNode }) {
  return (
    <div className="doc-hero not-prose relative mb-10 overflow-hidden rounded-2xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] p-6 shadow-[0_1px_0_0_color-mix(in_srgb,var(--rush-blue)_12%,transparent)] md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--rush-blue)_18%,transparent)_0%,transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-16 size-56 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--rush-purple)_14%,transparent)_0%,transparent_70%)]"
      />
      <div className="relative z-10">
        {eyebrow ? (
          <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--rush-cyan)]">
            {eyebrow}
          </p>
        ) : null}
        <div className="text-base leading-relaxed text-[var(--text-secondary)] md:text-lg [&_a]:font-medium [&_a]:text-[var(--rush-blue)] [&_a]:underline-offset-4 hover:[&_a]:text-[var(--rush-purple)] [&_strong]:font-semibold [&_strong]:text-[var(--text-primary)]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function DocStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="doc-stat flex flex-col rounded-xl border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_55%,var(--color-fd-card))] px-4 py-3 transition-colors hover:border-[color-mix(in_srgb,var(--rush-blue)_35%,var(--color-fd-border))]">
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

export function CompareGrid({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  );
}

export function CompareItem({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="group rounded-xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] p-4 transition-all hover:border-[color-mix(in_srgb,var(--rush-blue)_28%,var(--color-fd-border))] hover:shadow-[0_12px_40px_-12px_color-mix(in_srgb,var(--rush-blue)_20%,transparent)]">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{name}</h3>
      <div className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)] [&_p]:m-0">
        {children}
      </div>
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
                <span className="mt-0.5 block text-sm text-[var(--text-secondary)]">{item.description}</span>
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
          <p className="mt-2 text-sm font-medium leading-snug text-[var(--text-primary)]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, ArrowRight, CheckCircle2, Gauge, Globe2, Layers, Package, Puzzle, Sparkles, MapPin, Zap } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

export type StageStep = { label: string; accent?: boolean };

/**
 * Visible "you are here" marker for the One-Page guide's core concept
 * sections (Application / Middleware / Router / Context). Replaces the ad-hoc
 * `<p>📍 We are here —</p>` lines so every section communicates its position
 * on the request flow with the same shape and the same small diagram of the
 * stops — context the reader is meant to hold while reading the prose below.
 *
 * Feedback (one_page.md #9): "Code examples feel isolated — I don't know
 * where am I in the request flow" — surfacing the stage label above the code
 * keeps every section anchored to the page's recurring motif instead of
 * becoming a floating API tour.
 */
export function StageLabel({
  active,
  steps,
  note,
}: {
  active: string;
  steps: StageStep[];
  note: string;
}) {
  const activeIndex = steps.findIndex((s) => s.label === active);
  return (
    <div className="stage-label not-prose" role="group" aria-label="Position on the request flow">
      <div className="stage-label__map" aria-hidden>
        {steps.map((s, i) => {
          const isActive = i === activeIndex;
          const accentTint = s.accent ? 'var(--accent-soft)' : 'var(--text-subtle)';
          return (
            <span
              key={s.label}
              className="stage-label__stop"
              data-active={isActive ? '' : undefined}
              style={
                isActive
                  ? { color: 'var(--text-primary)', borderColor: 'var(--brand-link)', background: 'var(--brand-wash)' }
                  : { color: 'var(--text-subtle)', borderColor: 'transparent', background: 'transparent' }
              }
            >
              {s.label}
              {isActive ? <MapPin className="stage-label__pin" aria-hidden /> : null}
              {i < steps.length - 1 ? <span className="stage-label__sep" style={{ color: accentTint }}>·</span> : null}
            </span>
          );
        })}
      </div>
      <p className="stage-label__note">{note}</p>
    </div>
  );
}

/**
 * Visible end-of-act recap. Promotes the One-Page guide's three collapsed
 * `<details>You now understand — Act X checklist</details>` blocks into a
 * real checkpoint surface so a reader consolidates the act they just finished
 * before moving on, instead of the recap being hidden behind a disclosure.
 *
 * Feedback (one_page.md "Missing Recap moments"): the act ends had everything
 * a recap needs, but it was collapsed — the very readers who'd benefit most
 * from retrieval practice were the ones least likely to click it open. This
 * is the same content, surfaced. Each `item` is a one-sentence take-away; the
 * `act` prop labels which act just ended.
 */
export function RecapCheckpoint({ act, items }: { act: string; items: string[] }) {
  return (
    <section className="recap-checkpoint not-prose" aria-label={`What you now understand — ${act}`}>
      <header className="recap-checkpoint__header">
        <CheckCircle2 className="recap-checkpoint__icon" aria-hidden />
        <span className="recap-checkpoint__title">What you now understand · {act}</span>
      </header>
      <ul className="recap-checkpoint__list">
        {items.map((item) => (
          <li key={item} className="recap-checkpoint__item">
            <span className="recap-checkpoint__check" aria-hidden>✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export type ActNavItem = {
  /** Fragment anchor on the page, e.g. `act-how`. */
  href: string;
  /** Act index shown as a number badge. */
  n: number | string;
  /** Display label, e.g. `How`. */
  label: string;
};

/**
 * Sticky five-act strip for the One-Page guide. The page teaches the whole
 * framework in five acts (Why / How / Building / Running / Learning) but once
 * a reader scrolls past the second mental-model flow at the top, the page
 * offers nothing persistent to keep the "one big story" in view — feedback
 * (one_page.md "Missing a persistent 'big picture'"): "a small progress
 * strip at the top … then each section highlights its position."
 *
 * This is the no-scroll-spy version of that: five pill links that stay visible
 * while the relevant section is on screen and let a reader jump to any act.
 * Active-act highlighting requires IntersectionObserver; that's a separate
 * change, deliberately not bundled here (process: ship the persistent nav
 * first, add scroll-spy once the IA contract holds).
 */
export function ActNav({ acts }: { acts: ActNavItem[] }) {
  return (
    <nav className="act-nav not-prose" aria-label="Acts on this page">
      <ol className="act-nav__list">
        {acts.map((a) => (
          <li key={a.href} className="act-nav__item">
            <a href={`#${a.href}`} className="act-nav__link">
              <span className="act-nav__n" aria-hidden>{a.n}</span>
              <span className="act-nav__label">{a.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

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
    <div className="doc-hero not-prose relative mb-10 overflow-hidden rounded-2xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] p-4 sm:p-6 md:p-8">
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
    <div className="doc-stat flex flex-col rounded-xl border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_55%,var(--color-fd-card))] px-3.5 py-3 transition-colors hover:border-[var(--border-strong)]">
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
  return <div className="not-prose my-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

/**
 * Colorblind-safe framework palette (Okabe–Ito), matching apps/benchmark REPORT.md
 * scaling charts. Prefer `framework` over generic `accent` when labeling real
 * frameworks so every chart on the site shares one visual language.
 */
export type BenchmarkFrameworkId =
  | 'raw-node'
  | 'nextrush'
  | 'fastify'
  | 'hono'
  | 'koa'
  | 'express'
  | 'other';

export type BenchmarkBarItem = {
  label: string;
  value: number;
  detail?: string;
  /** @deprecated Prefer `framework` for consistent multi-chart coloring. */
  accent?: 'blue' | 'cyan' | 'purple' | 'green' | 'muted' | 'amber' | 'orange' | 'rose';
  /** Stable framework identity — drives bar color + optional highlight. */
  framework?: BenchmarkFrameworkId;
  /** Force highlight ring (defaults true for `nextrush`). */
  highlight?: boolean;
  /** Rank badge (1-based). Auto-inferred from sort order when omitted. */
  rank?: number;
};

type BenchmarkTone = {
  /** Tailwind gradient classes for the bar fill. */
  bar: string;
  /** Solid swatch for legends / rank dots. */
  swatch: string;
  /** Soft glow under the bar. */
  glow: string;
};

const FRAMEWORK_TONE: Record<BenchmarkFrameworkId, BenchmarkTone> = {
  // Okabe–Ito + brand: #E69F00 amber baseline, #56B4E9 sky target, #009E73
  // bluish-green Fastify, #D55E00 vermillion Hono, #CC79A7 reddish-purple Koa,
  // #0072B2 blue Express.
  'raw-node': {
    bar: 'from-amber-400 to-yellow-300',
    swatch: 'bg-amber-400',
    glow: 'shadow-[0_0_18px_color-mix(in_srgb,#E69F00_28%,transparent)]',
  },
  nextrush: {
    bar: 'from-sky-500 to-cyan-400',
    swatch: 'bg-sky-400',
    glow: 'shadow-[0_0_22px_color-mix(in_srgb,var(--rush-cyan)_40%,transparent)]',
  },
  fastify: {
    bar: 'from-emerald-500 to-teal-400',
    swatch: 'bg-emerald-500',
    glow: 'shadow-[0_0_16px_color-mix(in_srgb,#009E73_24%,transparent)]',
  },
  hono: {
    bar: 'from-orange-500 to-amber-400',
    swatch: 'bg-orange-500',
    glow: 'shadow-[0_0_16px_color-mix(in_srgb,#D55E00_22%,transparent)]',
  },
  koa: {
    bar: 'from-fuchsia-500 to-pink-400',
    swatch: 'bg-fuchsia-400',
    glow: 'shadow-[0_0_14px_color-mix(in_srgb,#CC79A7_22%,transparent)]',
  },
  express: {
    bar: 'from-blue-600 to-blue-400',
    swatch: 'bg-blue-500',
    glow: 'shadow-[0_0_14px_color-mix(in_srgb,#0072B2_22%,transparent)]',
  },
  other: {
    bar: 'from-slate-500 to-slate-400',
    swatch: 'bg-slate-400',
    glow: '',
  },
};

const LEGACY_ACCENT: Record<NonNullable<BenchmarkBarItem['accent']>, BenchmarkTone> = {
  blue: FRAMEWORK_TONE.nextrush,
  cyan: FRAMEWORK_TONE.fastify,
  purple: FRAMEWORK_TONE.koa,
  green: FRAMEWORK_TONE['raw-node'],
  muted: FRAMEWORK_TONE.other,
  amber: FRAMEWORK_TONE['raw-node'],
  orange: FRAMEWORK_TONE.hono,
  rose: FRAMEWORK_TONE.koa,
};

function resolveBenchmarkTone(item: BenchmarkBarItem): BenchmarkTone {
  if (item.framework) return FRAMEWORK_TONE[item.framework];
  if (item.accent) return LEGACY_ACCENT[item.accent];
  // Heuristic from label so existing pages still color correctly.
  const l = item.label.toLowerCase();
  if (l.includes('nextrush')) return FRAMEWORK_TONE.nextrush;
  if (l.includes('raw') || l.includes('baseline')) return FRAMEWORK_TONE['raw-node'];
  if (l.includes('fastify')) return FRAMEWORK_TONE.fastify;
  if (l.includes('hono')) return FRAMEWORK_TONE.hono;
  if (l.includes('koa')) return FRAMEWORK_TONE.koa;
  if (l.includes('express')) return FRAMEWORK_TONE.express;
  return FRAMEWORK_TONE.other;
}

function isHighlighted(item: BenchmarkBarItem): boolean {
  if (typeof item.highlight === 'boolean') return item.highlight;
  if (item.framework === 'nextrush') return true;
  return item.label.toLowerCase().includes('nextrush');
}

function formatBenchmarkValue(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString();
  // Keep one decimal for scores like 68.1 without trailing noise.
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function BenchmarkBars({
  title,
  description,
  items,
  suffix = ' RPS',
  legend,
  showRelative = true,
  compact = false,
}: {
  title: string;
  description?: string;
  items: BenchmarkBarItem[];
  suffix?: string;
  /** Shown upper-right; defaults depend on `suffix` (RPS vs relative %). */
  legend?: string;
  /** Show "% of leader" chip next to each value. Default true for RPS charts. */
  showRelative?: boolean;
  /** Tighter vertical rhythm for tabbed / multi-chart sections. */
  compact?: boolean;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  const defaultLegend =
    suffix.trim() === '%'
      ? 'of scenario best · higher is better'
      : suffix.trim() === 'pts' || suffix.includes('pts')
        ? 'points · higher is better'
        : 'req/s · higher is better';
  const relativeEnabled = showRelative && suffix.trim() !== '%';

  return (
    <section
      className={`not-prose overflow-hidden rounded-2xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] ${
        compact ? 'my-5 p-4 md:p-5' : 'my-8 p-5 md:p-6'
      }`}
      style={{
        backgroundImage:
          'linear-gradient(165deg, color-mix(in srgb, var(--color-fd-card) 94%, transparent), color-mix(in srgb, var(--rush-blue) 6%, var(--color-fd-card)))',
        boxShadow:
          '0 1px 0 0 color-mix(in srgb, white 6%, transparent), 0 28px 64px -40px color-mix(in srgb, var(--rush-blue) 35%, transparent)',
      }}
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight text-[var(--text-primary)] md:text-lg">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 self-start rounded-full border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_50%,transparent)] px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {legend ?? defaultLegend}
        </span>
      </div>

      <div className={compact ? 'space-y-3' : 'space-y-3.5'} role="list" aria-label={title}>
        {items.map((item, index) => {
          const pctOfMax = (item.value / max) * 100;
          // Floor at 4% so tiny bars stay visible; cap so 100% fills cleanly.
          const width = `${Math.min(Math.max(pctOfMax, 4), 100)}%`;
          const style = { '--benchmark-width': width } as CSSProperties;
          const tone = resolveBenchmarkTone(item);
          const highlighted = isHighlighted(item);
          const rank = item.rank ?? index + 1;

          return (
            <div
              key={item.label}
              role="listitem"
              className={`grid gap-1.5 rounded-xl px-2.5 py-2 transition-colors ${
                highlighted
                  ? 'bg-[color-mix(in_srgb,var(--rush-cyan)_8%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--rush-cyan)_28%,var(--color-fd-border))]'
                  : 'hover:bg-[color-mix(in_srgb,var(--color-fd-muted)_35%,transparent)]'
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--color-fd-muted)_70%,transparent)] font-mono text-[0.65rem] font-semibold tabular-nums text-[var(--text-muted)]"
                    aria-label={`Rank ${rank}`}
                  >
                    {rank}
                  </span>
                  <span
                    aria-hidden
                    className={`size-2 shrink-0 rounded-full ${tone.swatch}`}
                  />
                  <span
                    className={`truncate text-sm ${
                      highlighted
                        ? 'font-semibold text-[var(--text-primary)]'
                        : 'font-medium text-[var(--text-primary)]'
                    }`}
                  >
                    {item.label}
                  </span>
                  {highlighted ? (
                    <span className="hidden rounded-full bg-[color-mix(in_srgb,var(--rush-cyan)_18%,transparent)] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--rush-cyan)] sm:inline">
                      target
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-baseline gap-2">
                  {relativeEnabled ? (
                    <span className="hidden font-mono text-[0.7rem] tabular-nums text-[var(--text-muted)] sm:inline">
                      {Math.round(pctOfMax)}%
                    </span>
                  ) : null}
                  <span className="font-mono text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                    {formatBenchmarkValue(item.value)}
                    <span className="ml-0.5 text-xs font-medium text-[var(--text-muted)]">
                      {suffix}
                    </span>
                  </span>
                </div>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-fd-muted)_55%,transparent)] ring-1 ring-inset ring-[var(--color-fd-border)]">
                <div
                  className={`h-full w-[var(--benchmark-width)] rounded-full bg-gradient-to-r ${tone.bar} ${tone.glow} transition-[width] duration-500 ease-out`}
                  style={style}
                />
              </div>
              {item.detail ? (
                <p className="pl-7 text-xs leading-relaxed text-[var(--text-secondary)]">
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

/** Compact color key for the six frameworks used across benchmark charts. */
export function BenchmarkLegend({
  items = [
    { framework: 'raw-node', label: 'Raw Node.js' },
    { framework: 'nextrush', label: 'NextRush v3' },
    { framework: 'fastify', label: 'Fastify' },
    { framework: 'hono', label: 'Hono' },
    { framework: 'koa', label: 'Koa' },
    { framework: 'express', label: 'Express' },
  ],
}: {
  items?: Array<{ framework: BenchmarkFrameworkId; label: string }>;
}) {
  return (
    <div
      className="not-prose my-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_35%,var(--color-fd-card))] px-4 py-3"
      role="list"
      aria-label="Framework color legend"
    >
      {items.map((item) => {
        const tone = FRAMEWORK_TONE[item.framework];
        return (
          <span key={item.framework} role="listitem" className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span aria-hidden className={`size-2.5 rounded-full ${tone.swatch}`} />
            <span className="font-medium text-[var(--text-primary)]">{item.label}</span>
          </span>
        );
      })}
    </div>
  );
}

export type BenchmarkCardItem = {
  label: string;
  value: string;
  detail: string;
  /** Optional tone for the top accent rail. */
  tone?: 'nextrush' | 'baseline' | 'neutral' | 'warn';
};

const CARD_TONE: Record<NonNullable<BenchmarkCardItem['tone']>, string> = {
  nextrush: 'from-sky-500 to-cyan-400',
  baseline: 'from-amber-400 to-yellow-300',
  neutral: 'from-slate-400 to-slate-300',
  warn: 'from-orange-500 to-amber-400',
};

export function BenchmarkCardGrid({ items }: { items: BenchmarkCardItem[] }) {
  return (
    <div className="not-prose my-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const rail = CARD_TONE[item.tone ?? 'neutral'];
        return (
          <div
            key={item.label}
            className="group relative overflow-hidden rounded-2xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] p-5 shadow-[0_1px_0_0_color-mix(in_srgb,white_6%,transparent)] transition-all hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--rush-cyan)_32%,var(--color-fd-border))] hover:shadow-[0_16px_40px_-28px_color-mix(in_srgb,var(--rush-blue)_40%,transparent)]"
          >
            <div
              aria-hidden
              className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${rail}`}
            />
            <div
              aria-hidden
              className="absolute -right-10 -top-10 size-28 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--rush-cyan)_14%,transparent)_0%,transparent_70%)] transition-transform duration-300 group-hover:scale-125"
            />
            <p className="relative text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {item.label}
            </p>
            <p className="relative mt-3 font-mono text-2xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">
              {item.value}
            </p>
            <p className="relative mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              {item.detail}
            </p>
          </div>
        );
      })}
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
 *
 * `id` is opt-in: passing it attaches a fragment anchor to the eyebrow so the
 * One-Page guide can link its sticky Act nav strip to each Act's eyebrow
 * (#act-why, #act-how, …). Without `id`, behavior is unchanged.
 */
export function DocSectionEyebrow({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p
      id={id}
      className="not-prose mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-subtle)]"
    >
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

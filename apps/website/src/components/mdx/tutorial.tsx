import type { ReactNode } from 'react';

/**
 * Tutorial-only presentational helpers.
 *
 * DESIGN.md Documentation Mode: content first, calm surfaces, typography before
 * color. These exist to create *learning rhythm* (chapter → goal → change →
 * why → verify) — not marketing chrome. Prefer fewer, stronger markers over
 * stacking borders/cards.
 */

/** Progress strip — once near the top of a multi-part tutorial. */
export function TutorialProgress({
  title = 'Task API Tutorial',
  part,
  total = 3,
  label,
}: {
  title?: string;
  /** 1-based current part. 0 = overview. */
  part: number;
  total?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((part / total) * 100)));
  const status =
    label ?? (part <= 0 ? `Overview · ${total} parts` : `Part ${part} of ${total}`);

  return (
    <div className="not-prose my-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="text-xs font-medium tabular-nums text-[var(--text-secondary)]">{status}</p>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-fd-muted)_70%,transparent)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${title}: ${status}`}
      >
        <div
          className="h-full rounded-full bg-[var(--brand-solid)] transition-[width] duration-300"
          style={{ width: `${Math.max(pct, part > 0 ? 8 : 0)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Chapter band under a markdown H2 — marks a new phase without stealing the
 * heading (TOC stays driven by ## headings). Typography + left rule + surface;
 * no gradient, no nested cards.
 */
export function TutorialChapter({
  part,
  total = 3,
  tagline,
  focus,
}: {
  part: number;
  total?: number;
  /** One sentence: why this part matters now. */
  tagline: string;
  /** Short focus chips, e.g. "Request body", "Middleware". */
  focus?: string[];
}) {
  return (
    <div className="not-prose -mt-2 mb-8 border-l-[3px] border-[var(--brand-solid)] bg-[color-mix(in_srgb,var(--color-fd-muted)_28%,var(--color-fd-card))] py-4 pl-5 pr-4 md:pl-6">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--brand-link)]">
        Part {part} of {total}
      </p>
      <p className="mt-1.5 max-w-2xl text-base font-medium leading-relaxed text-[var(--text-primary)] md:text-lg">
        {tagline}
      </p>
      {focus && focus.length > 0 ? (
        <ul className="mt-3 flex list-none flex-wrap gap-2 p-0">
          {focus.map((item) => (
            <li
              key={item}
              className="rounded-md bg-[var(--color-fd-card)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] ring-1 ring-[color-mix(in_srgb,var(--color-fd-border)_80%,transparent)]"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Pipeline that highlights the *new* stage and dims only stages not unlocked yet.
 * Prefer this over a full Mermaid flowchart for progressive teaching.
 *
 * - `active` — index of the stage introduced in this part (gets a "New" badge)
 * - `unlocked` — last index the reader has (or will have) after this part
 *   Stages after `unlocked` render dashed/muted so the diagram grows over time.
 */
export function TutorialPipeline({
  steps,
  active,
  unlocked,
  label,
}: {
  steps: string[];
  /** Index of the stage introduced in this part (0-based). */
  active?: number;
  /** Last unlocked index inclusive. Defaults to all unlocked. */
  unlocked?: number;
  label?: string;
}) {
  const lastUnlocked = unlocked ?? steps.length - 1;

  return (
    <div className="not-prose my-5">
      {label ? (
        <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          {label}
        </p>
      ) : null}
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {steps.map((step, i) => {
          const isActive = active !== undefined && i === active;
          const isFuture = i > lastUnlocked;

          return (
            <li key={`${step}-${i}`} className="flex items-center gap-1.5">
              <span
                className={
                  isActive
                    ? 'rounded-full bg-[color-mix(in_srgb,var(--brand-solid)_14%,var(--color-fd-card))] px-3 py-1.5 text-sm font-semibold text-[var(--text-primary)] ring-2 ring-[color-mix(in_srgb,var(--brand-solid)_45%,transparent)]'
                    : isFuture
                      ? 'rounded-full bg-transparent px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] ring-1 ring-dashed ring-[var(--color-fd-border)]'
                      : 'rounded-full bg-[var(--color-fd-card)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] ring-1 ring-[var(--color-fd-border)]'
                }
                aria-current={isActive ? 'step' : undefined}
              >
                {isActive ? (
                  <span className="mr-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-[var(--brand-link)]">
                    New
                  </span>
                ) : null}
                {step}
              </span>
              {i < steps.length - 1 ? (
                <span
                  className={isFuture ? 'text-[var(--text-subtle)]' : 'text-[var(--text-secondary)]'}
                  aria-hidden
                >
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Product-demo style endpoint preview for the finished API. */
export function ApiDemo({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl bg-[var(--color-fd-card)] ring-1 ring-[color-mix(in_srgb,var(--color-fd-border)_75%,transparent)]">
      <div className="flex items-center justify-between gap-3 bg-[color-mix(in_srgb,var(--color-fd-muted)_40%,var(--color-fd-card))] px-4 py-2.5">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
          Task API · live shape
        </span>
        <span className="font-mono text-xs text-[var(--text-secondary)]">localhost:8080</span>
      </div>
      <ul className="divide-y divide-[color-mix(in_srgb,var(--color-fd-border)_65%,transparent)]">
        {children}
      </ul>
    </div>
  );
}

export function ApiDemoRow({
  method,
  path,
  status,
  statusLabel,
  body,
}: {
  method: string;
  path: string;
  status: string;
  statusLabel?: string;
  body?: string;
}) {
  const methodColor =
    method === 'POST'
      ? 'text-[var(--accent-success-fg)]'
      : method === 'DELETE'
        ? 'text-[var(--status-danger)]'
        : 'text-[var(--brand-link)]';

  return (
    <li className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(7.5rem,auto)_1fr_auto] sm:items-center sm:gap-4">
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className={`font-semibold ${methodColor}`}>{method}</span>
        <span className="font-medium text-[var(--text-primary)]">{path}</span>
      </div>
      <p className="font-mono text-xs text-[var(--text-primary)] sm:text-sm">{body ?? '—'}</p>
      <div className="flex items-center gap-2 sm:justify-end">
        <span className="rounded-md bg-[color-mix(in_srgb,var(--color-fd-muted)_55%,transparent)] px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-[var(--text-primary)]">
          {status}
        </span>
        {statusLabel ? (
          <span className="text-xs font-medium text-[var(--text-secondary)]">{statusLabel}</span>
        ) : null}
      </div>
    </li>
  );
}

/** Compact "you'll understand" list at the start of a part. */
export function LearningGoals({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-5">
      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        By the end of this part
      </p>
      <ul className="m-0 grid list-none gap-1.5 p-0 text-sm text-[var(--text-primary)] sm:grid-cols-2">
        {children}
      </ul>
    </div>
  );
}

export function LearningGoal({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 font-semibold text-[var(--accent-success-fg)]" aria-hidden>
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

/**
 * Architecture delta after a step — one mental model each side, not full code.
 */
export function WhatChanged({
  before,
  after,
  note,
}: {
  before: string;
  after: string;
  note?: string;
}) {
  return (
    <div className="not-prose my-5">
      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        What changed
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="rounded-lg bg-[color-mix(in_srgb,var(--color-fd-muted)_40%,var(--color-fd-card))] px-3 py-2.5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            Before
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-[var(--text-primary)] sm:text-sm">
            {before}
          </p>
        </div>
        <span className="hidden text-[var(--text-secondary)] sm:block" aria-hidden>
          →
        </span>
        <div className="rounded-lg bg-[color-mix(in_srgb,var(--brand-wash)_18%,var(--color-fd-card))] px-3 py-2.5 ring-1 ring-[color-mix(in_srgb,var(--brand-link)_25%,transparent)]">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--brand-link)]">
            After
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-[var(--text-primary)] sm:text-sm">
            {after}
          </p>
        </div>
      </div>
      {note ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{note}</p>
      ) : null}
    </div>
  );
}

/**
 * Distinct "why this works" band — scannable bullets, not another prose block.
 */
export function WhyItWorks({
  title = 'Why this works',
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="not-prose my-5 rounded-xl bg-[color-mix(in_srgb,var(--brand-wash)_12%,var(--color-fd-card))] px-4 py-3.5 ring-1 ring-[color-mix(in_srgb,var(--brand-link)_18%,transparent)]">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand-link)]">
        💡 {title}
      </p>
      <ul className="mt-2.5 m-0 grid list-none gap-1.5 p-0 text-sm leading-relaxed text-[var(--text-primary)]">
        {children}
      </ul>
    </div>
  );
}

export function WhyItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--brand-solid)]" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

/** Celebratory part checkpoint with momentum into the next part. */
export function TutorialCheckpoint({
  part,
  title,
  next,
  children,
}: {
  part: number;
  title: string;
  next?: string;
  children: ReactNode;
}) {
  return (
    <div className="not-prose my-8 rounded-xl bg-[color-mix(in_srgb,var(--accent-success-fg)_7%,var(--color-fd-card))] px-5 py-5 ring-1 ring-[color-mix(in_srgb,var(--accent-success-fg)_30%,var(--color-fd-border))]">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--accent-success-fg)]">
        ✅ Part {part} complete
      </p>
      <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="mt-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
        You now have
      </p>
      <ul className="mt-2 grid list-none gap-1.5 p-0 text-sm text-[var(--text-primary)] sm:grid-cols-2">
        {children}
      </ul>
      {next ? (
        <p className="mt-4 border-t border-[color-mix(in_srgb,var(--color-fd-border)_70%,transparent)] pt-3 text-sm text-[var(--text-primary)]">
          <span className="font-semibold text-[var(--accent-success-fg)]">Next →</span> {next}
        </p>
      ) : null}
    </div>
  );
}

export function CheckpointItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 font-semibold text-[var(--accent-success-fg)]" aria-hidden>
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

/** Graduation band for the finished project. */
export function TutorialGraduation({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="not-prose my-8 rounded-2xl bg-[color-mix(in_srgb,var(--brand-wash)_12%,var(--color-fd-card))] px-5 py-6 ring-1 ring-[color-mix(in_srgb,var(--brand-link)_22%,var(--color-fd-border))] md:px-7 md:py-7">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--brand-link)]">
        🎉 You built it
      </p>
      <p className="mt-1 text-xl font-semibold text-[var(--text-primary)] md:text-2xl">{title}</p>
      <ul className="mt-4 grid list-none gap-2 p-0 text-sm text-[var(--text-primary)] sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </ul>
    </div>
  );
}

export function GraduationItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 font-semibold text-[var(--brand-link)]" aria-hidden>
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

/** Elevated reflection questions — differentiates from plain bullets. */
export function ArchitectChallenge({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-6">
      <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--brand-link)]">
        Architect challenge
      </p>
      <ol className="m-0 grid list-none gap-3 p-0">{children}</ol>
    </div>
  );
}

export function ArchitectQuestion({
  n,
  children,
}: {
  n: number;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-xl bg-[color-mix(in_srgb,var(--color-fd-muted)_32%,var(--color-fd-card))] px-4 py-3.5">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-fd-card)] text-xs font-bold tabular-nums text-[var(--brand-link)] ring-1 ring-[color-mix(in_srgb,var(--brand-link)_25%,transparent)]"
        aria-hidden
      >
        {n}
      </span>
      <div className="m-0 text-sm leading-relaxed text-[var(--text-primary)] md:text-[0.95rem]">
        {children}
      </div>
    </li>
  );
}

/** Difficulty-tiered exercise list for "Try it yourself". */
export function ChallengeList({ children }: { children: ReactNode }) {
  return <div className="not-prose my-5 grid gap-3">{children}</div>;
}

export function Challenge({
  level,
  title,
  time,
  children,
}: {
  /** Avoid marketing hedge words banned by docs:verify (e.g. "easy"). */
  level: 'Starter' | 'Intermediate' | 'Advanced' | 'Expert';
  title: string;
  /** Estimated effort, e.g. "~5 min". */
  time?: string;
  children?: ReactNode;
}) {
  const tone: Record<typeof level, string> = {
    Starter:
      'text-[var(--accent-success-fg)] bg-[color-mix(in_srgb,var(--accent-success-fg)_10%,transparent)]',
    Intermediate:
      'text-[var(--brand-link)] bg-[color-mix(in_srgb,var(--brand-link)_10%,transparent)]',
    Advanced:
      'text-[var(--status-warning-text)] bg-[color-mix(in_srgb,var(--status-warning)_12%,transparent)]',
    Expert: 'text-[var(--rush-purple)] bg-[color-mix(in_srgb,var(--rush-purple)_12%,transparent)]',
  };

  return (
    <div className="rounded-xl bg-[color-mix(in_srgb,var(--color-fd-muted)_28%,var(--color-fd-card))] px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${tone[level]}`}
        >
          {level}
        </span>
        {time ? (
          <span className="text-xs font-medium tabular-nums text-[var(--text-secondary)]">{time}</span>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      {children ? (
        <div className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{children}</div>
      ) : null}
    </div>
  );
}

/** Severity-tagged common mistake — fix is the scannable payoff. */
export function MistakeList({ children }: { children: ReactNode }) {
  return <div className="not-prose my-5 grid gap-3">{children}</div>;
}

export function Mistake({
  severity = 'warn',
  title,
  symptom,
  cause,
  fix,
}: {
  severity?: 'warn' | 'error' | 'info';
  title: string;
  symptom: string;
  cause: string;
  fix: string;
}) {
  const icon = severity === 'error' ? '⛔' : severity === 'info' ? 'ℹ' : '⚠';
  const accent =
    severity === 'error'
      ? 'border-l-[var(--status-danger)]'
      : severity === 'info'
        ? 'border-l-[var(--brand-link)]'
        : 'border-l-[var(--status-warning)]';

  return (
    <div
      className={`rounded-r-xl border-l-[3px] bg-[color-mix(in_srgb,var(--color-fd-muted)_28%,var(--color-fd-card))] py-3 pl-4 pr-4 ${accent}`}
    >
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        <span className="mr-1.5" aria-hidden>
          {icon}
        </span>
        {title}
      </p>
      <dl className="mt-2 grid gap-1.5 text-sm">
        <div>
          <dt className="inline font-medium text-[var(--text-secondary)]">Symptom: </dt>
          <dd className="inline text-[var(--text-primary)]">{symptom}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-[var(--text-secondary)]">Cause: </dt>
          <dd className="inline text-[var(--text-primary)]">{cause}</dd>
        </div>
      </dl>
      <p className="mt-2.5 rounded-lg bg-[color-mix(in_srgb,var(--accent-success-fg)_9%,var(--color-fd-card))] px-3 py-2 text-sm text-[var(--text-primary)]">
        <span className="font-semibold text-[var(--accent-success-fg)]">✅ Fix: </span>
        {fix}
      </p>
    </div>
  );
}

import type { ReactNode } from 'react';

/**
 * Tutorial-only presentational helpers. Keep surfaces quiet (DESIGN.md:
 * whitespace + typography over decoration) — these exist to teach pacing,
 * not to look like marketing cards.
 */

/** Progress strip for multi-part tutorials. Use at the top and at each part. */
export function TutorialProgress({
  title = 'Task API Tutorial',
  part,
  total = 3,
  label,
}: {
  title?: string;
  /** 1-based current part. 0 = not started (overview). */
  part: number;
  total?: number;
  /** Optional short status, e.g. "Create the application". */
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((part / total) * 100)));
  const status =
    label ??
    (part <= 0 ? `Overview · ${total} parts` : `Part ${part} of ${total}`);

  return (
    <div className="not-prose my-6 rounded-xl bg-[color-mix(in_srgb,var(--color-fd-muted)_40%,var(--color-fd-card))] px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="text-xs font-medium tabular-nums text-[var(--text-muted)]">{status}</p>
      </div>
      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-fd-muted)_80%,transparent)]"
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

/** Product-demo style endpoint preview for the finished API. */
export function ApiDemo({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--color-fd-border)_70%,transparent)] bg-[var(--color-fd-card)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--color-fd-border)_70%,transparent)] bg-[color-mix(in_srgb,var(--color-fd-muted)_35%,var(--color-fd-card))] px-4 py-2.5">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Task API · live shape
        </span>
        <span className="font-mono text-xs text-[var(--text-subtle)]">localhost:8080</span>
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
    <li className="grid gap-1 px-4 py-3 sm:grid-cols-[7.5rem_1fr_auto] sm:items-center sm:gap-4">
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className={`font-semibold ${methodColor}`}>{method}</span>
        <span className="text-[var(--text-primary)]">{path}</span>
      </div>
      <p className="font-mono text-xs text-[var(--text-secondary)] sm:text-sm">
        {body ?? '—'}
      </p>
      <div className="flex items-center gap-2 sm:justify-end">
        <span className="rounded-md bg-[color-mix(in_srgb,var(--color-fd-muted)_55%,transparent)] px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-[var(--text-primary)]">
          {status}
        </span>
        {statusLabel ? (
          <span className="text-xs text-[var(--text-muted)]">{statusLabel}</span>
        ) : null}
      </div>
    </li>
  );
}

/** Compact "you'll understand" list at the start of a part. */
export function LearningGoals({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-5 rounded-xl bg-[color-mix(in_srgb,var(--color-fd-muted)_35%,var(--color-fd-card))] px-4 py-3.5">
      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        By the end of this part
      </p>
      <ul className="m-0 grid list-none gap-1.5 p-0 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
        {children}
      </ul>
    </div>
  );
}

export function LearningGoal({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 text-[var(--accent-success-fg)]" aria-hidden>
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

/**
 * Architecture delta after a step. Keep before/after short — one mental model
 * each, not full code.
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
    <div className="not-prose my-5 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div className="rounded-lg bg-[color-mix(in_srgb,var(--color-fd-muted)_40%,var(--color-fd-card))] px-3 py-2.5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Before
        </p>
        <p className="mt-1 font-mono text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
          {before}
        </p>
      </div>
      <span className="hidden text-[var(--text-subtle)] sm:block" aria-hidden>
        →
      </span>
      <div className="rounded-lg bg-[color-mix(in_srgb,var(--brand-wash)_14%,var(--color-fd-card))] px-3 py-2.5 ring-1 ring-[color-mix(in_srgb,var(--brand-link)_22%,transparent)]">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--brand-link)]">
          After
        </p>
        <p className="mt-1 font-mono text-xs leading-relaxed text-[var(--text-primary)] sm:text-sm">
          {after}
        </p>
      </div>
      {note ? (
        <p className="sm:col-span-3 text-xs leading-relaxed text-[var(--text-muted)]">{note}</p>
      ) : null}
    </div>
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
  /** One-line "what's next" for momentum. */
  next?: string;
  children: ReactNode;
}) {
  return (
    <div className="not-prose my-8 rounded-xl border border-[color-mix(in_srgb,var(--accent-success-fg)_28%,var(--color-fd-border))] bg-[color-mix(in_srgb,var(--accent-success-fg)_6%,var(--color-fd-card))] px-5 py-5">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--accent-success-fg)]">
        ✅ Part {part} complete
      </p>
      <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
      <ul className="mt-3 grid list-none gap-1.5 p-0 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
        {children}
      </ul>
      {next ? (
        <p className="mt-4 border-t border-[color-mix(in_srgb,var(--color-fd-border)_70%,transparent)] pt-3 text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">Next:</span> {next}
        </p>
      ) : null}
    </div>
  );
}

export function CheckpointItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 text-[var(--accent-success-fg)]" aria-hidden>
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
    <div className="not-prose my-8 rounded-2xl bg-[color-mix(in_srgb,var(--brand-wash)_10%,var(--color-fd-card))] px-5 py-6 ring-1 ring-[color-mix(in_srgb,var(--brand-link)_20%,var(--color-fd-border))] md:px-7 md:py-7">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--brand-link)]">
        🎉 You built it
      </p>
      <h3 className="mt-1 text-xl font-semibold text-[var(--text-primary)] md:text-2xl">{title}</h3>
      <ul className="mt-4 grid list-none gap-2 p-0 text-sm text-[var(--text-secondary)] sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </ul>
    </div>
  );
}

export function GraduationItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 text-[var(--brand-link)]" aria-hidden>
        ✓
      </span>
      <span>{children}</span>
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
  children,
}: {
  /** Avoid marketing hedge words banned by docs:verify (e.g. "easy"). */
  level: 'Starter' | 'Intermediate' | 'Advanced' | 'Expert';
  title: string;
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
    <div className="rounded-xl bg-[color-mix(in_srgb,var(--color-fd-muted)_30%,var(--color-fd-card))] px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${tone[level]}`}>
          {level}
        </span>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      </div>
      {children ? (
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{children}</p>
      ) : null}
    </div>
  );
}

/** Severity-tagged common mistake row. */
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
    <div className={`rounded-r-xl border-l-[3px] bg-[color-mix(in_srgb,var(--color-fd-muted)_30%,var(--color-fd-card))] py-3 pl-4 pr-4 ${accent}`}>
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        <span className="mr-1.5" aria-hidden>
          {icon}
        </span>
        {title}
      </p>
      <dl className="mt-2 grid gap-1.5 text-sm">
        <div>
          <dt className="inline font-medium text-[var(--text-muted)]">Symptom: </dt>
          <dd className="inline text-[var(--text-secondary)]">{symptom}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-[var(--text-muted)]">Cause: </dt>
          <dd className="inline text-[var(--text-secondary)]">{cause}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-[var(--text-muted)]">Fix: </dt>
          <dd className="inline text-[var(--text-secondary)]">{fix}</dd>
        </div>
      </dl>
    </div>
  );
}

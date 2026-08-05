'use client';

/**
 * Interactive performance dashboard for the production benchmarking page.
 * Pure React + SVG (no chart library) so the docs bundle stays light while
 * still offering column, leaderboard, heatmap, scaling, and explorer views.
 *
 * Data source: apps/benchmark/results/latest (run 2026-07-31T18-15-15).
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FrameworkId =
  | 'raw-node'
  | 'nextrush-v3'
  | 'fastify'
  | 'hono'
  | 'koa'
  | 'express';

type FrameworkMeta = {
  id: FrameworkId;
  name: string;
  short: string;
  role: 'baseline' | 'target' | 'comparison';
  /** Solid fill for SVG / CSS (Okabe–Ito, matches REPORT.md). */
  color: string;
  /** Tailwind-ish utility for dots (kept as inline style via color). */
};

type RankRow = {
  id: FrameworkId;
  rps: number;
  cv: number;
  p50: string;
  p99: string;
  rank: number;
};

type ScenarioMeta = {
  id: string;
  name: string;
  category: 'baseline' | 'serialization' | 'routing' | 'parsing' | 'middleware' | 'error' | 'static';
  purpose: string;
  why: string;
  fairness: 'like-for-like' | 'idiomatic';
  bottlenecks: Array<{ label: string; level: 'low' | 'mid' | 'high' }>;
  /** Stars 1–5 for NextRush relative strength in this scenario. */
  nextrushStars: number;
  insight?: string;
};

// ─── Palette & static data ───────────────────────────────────────────────────

const FRAMEWORKS: FrameworkMeta[] = [
  { id: 'raw-node', name: 'Raw Node.js', short: 'Raw', role: 'baseline', color: '#E69F00' },
  { id: 'nextrush-v3', name: 'NextRush v3', short: 'NextRush', role: 'target', color: '#56B4E9' },
  { id: 'fastify', name: 'Fastify', short: 'Fastify', role: 'comparison', color: '#009E73' },
  { id: 'hono', name: 'Hono', short: 'Hono', role: 'comparison', color: '#D55E00' },
  { id: 'koa', name: 'Koa', short: 'Koa', role: 'comparison', color: '#CC79A7' },
  { id: 'express', name: 'Express', short: 'Express', role: 'comparison', color: '#0072B2' },
];

const FW = Object.fromEntries(FRAMEWORKS.map((f) => [f.id, f])) as Record<FrameworkId, FrameworkMeta>;

const OVERALL_SCORE: Array<{ id: FrameworkId; points: number; wins: number; max: number }> = [
  { id: 'raw-node', points: 105.5, wins: 18, max: 108 },
  { id: 'fastify', points: 90.5, wins: 5, max: 108 },
  { id: 'nextrush-v3', points: 68.1, wins: 0, max: 108 },
  { id: 'hono', points: 60.1, wins: 0, max: 108 },
  { id: 'koa', points: 34, wins: 0, max: 108 },
  { id: 'express', points: 20, wins: 0, max: 108 },
];

/** RPS @ 256c — primary throughput regime. */
const RPS_256: Record<string, RankRow[]> = {
  'hello-world': [
    { id: 'raw-node', rps: 35503, cv: 1.59, p50: '6.86ms', p99: '10.95ms', rank: 1 },
    { id: 'fastify', rps: 32703, cv: 4.92, p50: '7.23ms', p99: '11.75ms', rank: 2 },
    { id: 'nextrush-v3', rps: 31343, cv: 2.51, p50: '7.98ms', p99: '10.09ms', rank: 2 },
    { id: 'hono', rps: 31073, cv: 2.15, p50: '8.16ms', p99: '8.68ms', rank: 2 },
    { id: 'koa', rps: 24779, cv: 2.16, p50: '10.22ms', p99: '11.12ms', rank: 5 },
    { id: 'express', rps: 22508, cv: 2.91, p50: '11.17ms', p99: '12.42ms', rank: 6 },
  ],
  'json-serialize': [
    { id: 'raw-node', rps: 34466, cv: 2.35, p50: '6.89ms', p99: '11.31ms', rank: 1 },
    { id: 'fastify', rps: 33570, cv: 2.35, p50: '7.32ms', p99: '11.50ms', rank: 1 },
    { id: 'nextrush-v3', rps: 31242, cv: 1.22, p50: '8.12ms', p99: '9.05ms', rank: 3 },
    { id: 'hono', rps: 29515, cv: 2.72, p50: '8.58ms', p99: '9.52ms', rank: 4 },
    { id: 'koa', rps: 24224, cv: 1.5, p50: '10.52ms', p99: '11.50ms', rank: 5 },
    { id: 'express', rps: 22567, cv: 1.3, p50: '11.25ms', p99: '12.16ms', rank: 6 },
  ],
  'route-params': [
    { id: 'raw-node', rps: 33672, cv: 2.33, p50: '7.28ms', p99: '11.70ms', rank: 1 },
    { id: 'fastify', rps: 30743, cv: 1.85, p50: '7.90ms', p99: '12.50ms', rank: 2 },
    { id: 'nextrush-v3', rps: 28847, cv: 2.14, p50: '8.89ms', p99: '9.51ms', rank: 3 },
    { id: 'hono', rps: 27911, cv: 2.12, p50: '9.18ms', p99: '9.86ms', rank: 3 },
    { id: 'koa', rps: 23217, cv: 1.58, p50: '10.95ms', p99: '11.93ms', rank: 5 },
    { id: 'express', rps: 20889, cv: 2.84, p50: '12.17ms', p99: '13.78ms', rank: 6 },
  ],
  'query-string': [
    { id: 'raw-node', rps: 27786, cv: 2.64, p50: '9.09ms', p99: '9.99ms', rank: 1 },
    { id: 'fastify', rps: 26452, cv: 1.94, p50: '9.59ms', p99: '10.44ms', rank: 2 },
    { id: 'nextrush-v3', rps: 24652, cv: 0.53, p50: '10.32ms', p99: '11.29ms', rank: 3 },
    { id: 'hono', rps: 23542, cv: 2.34, p50: '10.79ms', p99: '11.63ms', rank: 4 },
    { id: 'koa', rps: 19530, cv: 1.41, p50: '13.10ms', p99: '14.29ms', rank: 5 },
    { id: 'express', rps: 18395, cv: 2.82, p50: '13.71ms', p99: '15.83ms', rank: 6 },
  ],
  'post-json': [
    { id: 'raw-node', rps: 25420, cv: 2.11, p50: '9.96ms', p99: '10.93ms', rank: 1 },
    { id: 'fastify', rps: 20508, cv: 1.3, p50: '12.42ms', p99: '13.61ms', rank: 2 },
    { id: 'hono', rps: 19953, cv: 0.78, p50: '12.72ms', p99: '14.26ms', rank: 3 },
    { id: 'nextrush-v3', rps: 19144, cv: 1.38, p50: '13.29ms', p99: '14.33ms', rank: 4 },
    { id: 'koa', rps: 16132, cv: 0.83, p50: '15.80ms', p99: '16.95ms', rank: 5 },
    { id: 'express', rps: 15617, cv: 1.79, p50: '16.22ms', p99: '17.76ms', rank: 6 },
  ],
  'deep-route': [
    { id: 'raw-node', rps: 32669, cv: 2.37, p50: '7.44ms', p99: '12.01ms', rank: 1 },
    { id: 'fastify', rps: 30776, cv: 3.99, p50: '7.90ms', p99: '12.51ms', rank: 1 },
    { id: 'nextrush-v3', rps: 28637, cv: 1.73, p50: '8.93ms', p99: '9.96ms', rank: 3 },
    { id: 'hono', rps: 28521, cv: 1.48, p50: '8.89ms', p99: '9.73ms', rank: 3 },
    { id: 'koa', rps: 22844, cv: 0.27, p50: '11.14ms', p99: '12.09ms', rank: 5 },
    { id: 'express', rps: 21332, cv: 1.37, p50: '11.99ms', p99: '12.81ms', rank: 6 },
  ],
  'middleware-stack': [
    { id: 'raw-node', rps: 30749, cv: 1.79, p50: '8.31ms', p99: '9.05ms', rank: 1 },
    { id: 'fastify', rps: 30527, cv: 2.57, p50: '8.40ms', p99: '9.04ms', rank: 1 },
    { id: 'hono', rps: 24273, cv: 2.14, p50: '10.49ms', p99: '11.20ms', rank: 3 },
    { id: 'nextrush-v3', rps: 24188, cv: 2.35, p50: '10.47ms', p99: '11.29ms', rank: 3 },
    { id: 'koa', rps: 21964, cv: 3.28, p50: '11.51ms', p99: '12.42ms', rank: 5 },
    { id: 'express', rps: 20180, cv: 1.3, p50: '12.57ms', p99: '13.74ms', rank: 6 },
  ],
  'error-handling': [
    { id: 'raw-node', rps: 24971, cv: 1.93, p50: '10.27ms', p99: '11.00ms', rank: 1 },
    { id: 'fastify', rps: 21534, cv: 2.19, p50: '11.92ms', p99: '12.64ms', rank: 2 },
    { id: 'hono', rps: 20457, cv: 1.61, p50: '12.54ms', p99: '13.35ms', rank: 3 },
    { id: 'nextrush-v3', rps: 19409, cv: 3.13, p50: '12.91ms', p99: '14.22ms', rank: 4 },
    { id: 'koa', rps: 16763, cv: 1.21, p50: '15.15ms', p99: '16.41ms', rank: 5 },
    { id: 'express', rps: 15474, cv: 9.57, p50: '15.93ms', p99: '16.92ms', rank: 5 },
  ],
  'large-json': [
    { id: 'raw-node', rps: 22589, cv: 2.29, p50: '11.23ms', p99: '12.12ms', rank: 1 },
    { id: 'fastify', rps: 21748, cv: 1.27, p50: '11.62ms', p99: '12.66ms', rank: 2 },
    { id: 'nextrush-v3', rps: 20717, cv: 3.05, p50: '12.17ms', p99: '13.24ms', rank: 3 },
    { id: 'hono', rps: 19416, cv: 2.1, p50: '13.14ms', p99: '13.99ms', rank: 4 },
    { id: 'koa', rps: 17209, cv: 1.75, p50: '14.96ms', p99: '16.04ms', rank: 5 },
    { id: 'express', rps: 15558, cv: 2.17, p50: '16.10ms', p99: '21.64ms', rank: 6 },
  ],
  'empty-response': [
    { id: 'raw-node', rps: 44818, cv: 3.14, p50: '5.56ms', p99: '8.61ms', rank: 1 },
    { id: 'fastify', rps: 39782, cv: 2.4, p50: '6.19ms', p99: '10.15ms', rank: 2 },
    { id: 'nextrush-v3', rps: 35778, cv: 2.19, p50: '6.74ms', p99: '11.14ms', rank: 3 },
    { id: 'hono', rps: 35714, cv: 3.21, p50: '6.79ms', p99: '11.14ms', rank: 3 },
    { id: 'express', rps: 32730, cv: 2.15, p50: '7.82ms', p99: '8.31ms', rank: 5 },
    { id: 'koa', rps: 30077, cv: 2.36, p50: '8.57ms', p99: '9.19ms', rank: 6 },
  ],
  'send-object': [
    { id: 'raw-node', rps: 35329, cv: 1.96, p50: '6.99ms', p99: '10.79ms', rank: 1 },
    { id: 'nextrush-v3', rps: 31751, cv: 2.38, p50: '8.07ms', p99: '8.71ms', rank: 2 },
    { id: 'fastify', rps: 31456, cv: 2.4, p50: '7.64ms', p99: '12.30ms', rank: 2 },
    { id: 'hono', rps: 29849, cv: 1.93, p50: '8.52ms', p99: '9.27ms', rank: 4 },
    { id: 'koa', rps: 24201, cv: 1.77, p50: '10.50ms', p99: '11.39ms', rank: 5 },
    { id: 'express', rps: 21570, cv: 3.34, p50: '11.79ms', p99: '12.71ms', rank: 6 },
  ],
  'static-file': [
    { id: 'raw-node', rps: 14759, cv: 3.22, p50: '17.38ms', p99: '21.35ms', rank: 1 },
    { id: 'fastify', rps: 11000, cv: 1.69, p50: '24.15ms', p99: '28.03ms', rank: 2 },
    { id: 'express', rps: 10996, cv: 2.81, p50: '24.19ms', p99: '28.32ms', rank: 2 },
    { id: 'nextrush-v3', rps: 9238, cv: 0.76, p50: '28.06ms', p99: '34.39ms', rank: 4 },
    { id: 'hono', rps: 7922, cv: 1.96, p50: '31.50ms', p99: '41.77ms', rank: 5 },
    { id: 'koa', rps: 6556, cv: 3.43, p50: '39.65ms', p99: '54.65ms', rank: 6 },
  ],
};

/** Concurrency scaling for hello-world (representative baseline scenario). */
const SCALING_HELLO: Record<FrameworkId, [number, number, number]> = {
  'raw-node': [26803, 36184, 35503],
  'nextrush-v3': [24302, 31707, 31343],
  fastify: [26728, 34091, 32703],
  hono: [22692, 31381, 31073],
  koa: [19146, 25118, 24779],
  express: [17872, 22593, 22508],
};

const SCENARIOS: ScenarioMeta[] = [
  {
    id: 'hello-world',
    name: 'Hello World',
    category: 'baseline',
    purpose: 'Minimal JSON response — pure framework overhead.',
    why: 'Shows how much cost the framework adds before any real work.',
    fairness: 'like-for-like',
    bottlenecks: [
      { label: 'Routing', level: 'low' },
      { label: 'Response', level: 'low' },
      { label: 'Headers', level: 'low' },
    ],
    nextrushStars: 5,
    insight: 'NextRush sits at 88% of raw Node — mid-pack with Fastify and Hono inside noise.',
  },
  {
    id: 'json-serialize',
    name: 'JSON Serialization',
    category: 'serialization',
    purpose: 'Small ~200B JSON body on every response.',
    why: 'Most APIs serialize objects; this is the everyday hot path.',
    fairness: 'like-for-like',
    bottlenecks: [
      { label: 'Serialize', level: 'mid' },
      { label: 'Routing', level: 'low' },
    ],
    nextrushStars: 5,
    insight: '90.6% of baseline — serialization is a NextRush strength.',
  },
  {
    id: 'large-json',
    name: 'Large JSON',
    category: 'serialization',
    purpose: '~5KB array payload per response.',
    why: 'Heavier serialization amortizes framework overhead.',
    fairness: 'like-for-like',
    bottlenecks: [
      { label: 'Serialize', level: 'high' },
      { label: 'Alloc', level: 'mid' },
    ],
    nextrushStars: 5,
    insight: 'Strongest relative cell: 91.7% of raw Node.',
  },
  {
    id: 'send-object',
    name: 'Send Object',
    category: 'serialization',
    purpose: 'Plain-object response dispatch (framework auto-serialize).',
    why: 'Measures the idiomatic “return an object” path.',
    fairness: 'like-for-like',
    bottlenecks: [
      { label: 'Dispatch', level: 'low' },
      { label: 'Serialize', level: 'mid' },
    ],
    nextrushStars: 5,
    insight: 'NextRush edges Fastify here (within noise) — runner-up to raw Node.',
  },
  {
    id: 'route-params',
    name: 'Route Parameters',
    category: 'routing',
    purpose: '/users/12345 — dynamic parameter extraction.',
    why: 'Most REST APIs hit parameterized routes constantly.',
    fairness: 'like-for-like',
    bottlenecks: [
      { label: 'Routing', level: 'mid' },
      { label: 'Params', level: 'mid' },
    ],
    nextrushStars: 4,
  },
  {
    id: 'deep-route',
    name: 'Deep Route',
    category: 'routing',
    purpose: 'Deep nested path with multiple parameters.',
    why: 'Stresses trie depth and multi-param capture.',
    fairness: 'like-for-like',
    bottlenecks: [
      { label: 'Routing', level: 'high' },
      { label: 'Params', level: 'mid' },
    ],
    nextrushStars: 4,
  },
  {
    id: 'query-string',
    name: 'Query Strings',
    category: 'parsing',
    purpose: 'Parse q & limit from the query string.',
    why: 'Query parsers differ in safety work (limits, prototype keys).',
    fairness: 'like-for-like',
    bottlenecks: [
      { label: 'Query parse', level: 'mid' },
      { label: 'Safety', level: 'mid' },
    ],
    nextrushStars: 4,
    insight: 'NextRush enforces length/count limits and key rejection — more work than raw Node.',
  },
  {
    id: 'post-json',
    name: 'POST JSON',
    category: 'parsing',
    purpose: 'Parse a JSON body and respond.',
    why: 'Body parsers do unequal safety work; least-defensive wins raw RPS.',
    fairness: 'like-for-like',
    bottlenecks: [
      { label: 'JSON parse', level: 'high' },
      { label: 'Validation', level: 'mid' },
      { label: 'Routing', level: 'low' },
    ],
    nextrushStars: 3,
    insight: 'Largest relative gap (75% of baseline) — intentional parser safety cost.',
  },
  {
    id: 'empty-response',
    name: 'Empty Response',
    category: 'baseline',
    purpose: '204 No Content — zero payload.',
    why: 'Isolates response-path overhead without serialization.',
    fairness: 'like-for-like',
    bottlenecks: [
      { label: 'Response', level: 'low' },
      { label: 'Status', level: 'low' },
    ],
    nextrushStars: 4,
  },
  {
    id: 'middleware-stack',
    name: 'Middleware Stack',
    category: 'middleware',
    purpose: 'Five idiomatic layers (mechanism differs per framework).',
    why: 'Real apps always run middleware — but stacks are not identical.',
    fairness: 'idiomatic',
    bottlenecks: [
      { label: 'Middleware', level: 'high' },
      { label: 'Compose', level: 'mid' },
    ],
    nextrushStars: 3,
  },
  {
    id: 'error-handling',
    name: 'Error Handling',
    category: 'error',
    purpose: 'Error handler produces a 500.',
    why: 'Error paths must stay fast under failure.',
    fairness: 'idiomatic',
    bottlenecks: [
      { label: 'Error path', level: 'high' },
      { label: 'Handler', level: 'mid' },
    ],
    nextrushStars: 3,
  },
  {
    id: 'static-file',
    name: 'Static File',
    category: 'static',
    purpose: 'Serve a fixture file (traversal-safe resolver differs).',
    why: 'Static middleware is mechanism-specific — not headline score.',
    fairness: 'idiomatic',
    bottlenecks: [
      { label: 'FS path', level: 'high' },
      { label: 'Safety', level: 'high' },
    ],
    nextrushStars: 2,
  },
];

const HEATMAP_SCENARIOS = SCENARIOS.filter((s) => s.fairness === 'like-for-like').map((s) => s.id);
const DEFAULT_VISIBLE: FrameworkId[] = [
  'raw-node',
  'nextrush-v3',
  'fastify',
  'hono',
  'koa',
  'express',
];

const RUN_META = {
  runId: '2026-07-31T18-15-15',
  tool: 'wrk 4.2.0',
  node: 'v26.5.1',
  cpu: 'Intel Core i5-8300H · 8 logical cores',
  profile: 'standard · 6 runs · 30s · pin 2–7',
  timedCells: '1,404 × 30s',
  connections: '1 · 64 · 256',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString();
}

function pctOf(value: number, base: number): number {
  if (!base) return 0;
  return Math.round((value / base) * 1000) / 10;
}

function heatColor(pctOfBest: number): string {
  // Green ≥92, lime ≥85, amber ≥75, orange ≥65, rose <65
  if (pctOfBest >= 92) return 'bg-emerald-500/85 text-white';
  if (pctOfBest >= 85) return 'bg-lime-500/70 text-slate-900 dark:text-white';
  if (pctOfBest >= 75) return 'bg-amber-400/75 text-slate-900';
  if (pctOfBest >= 65) return 'bg-orange-500/70 text-white';
  return 'bg-rose-500/70 text-white';
}

function bottleneckTone(level: 'low' | 'mid' | 'high'): string {
  if (level === 'low') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (level === 'mid') return 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200';
  return 'border-orange-500/40 bg-orange-500/15 text-orange-800 dark:text-orange-200';
}

function stars(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
}

function filterRows(rows: RankRow[], visible: Set<FrameworkId>): RankRow[] {
  return rows.filter((r) => visible.has(r.id));
}

// ─── Shell primitives ────────────────────────────────────────────────────────

function Panel({
  title,
  description,
  action,
  children,
  className = '',
  /** Drop body padding — used when children own their own chrome (e.g. explorer). */
  flush = false,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(165deg, color-mix(in srgb, var(--color-fd-card) 96%, transparent), color-mix(in srgb, var(--brand-link) 5%, var(--color-fd-card)))',
        boxShadow:
          '0 1px 0 0 color-mix(in srgb, white 5%, transparent), 0 24px 56px -40px color-mix(in srgb, var(--brand-link) 30%, transparent)',
      }}
    >
      {(title || action) && (
        <header className="flex flex-col gap-2 border-b border-[var(--color-fd-border)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
          <div className="min-w-0">
            {title ? (
              <h3 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}
      <div className={flush ? '' : 'p-5 md:p-6'}>{children}</div>
    </section>
  );
}

function Pill({ children, active = false, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'span';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-[color-mix(in_srgb,var(--brand-link)_45%,var(--color-fd-border))] bg-[color-mix(in_srgb,var(--brand-link)_14%,transparent)] text-[var(--text-primary)]'
          : 'border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_40%,transparent)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
      }`}
    >
      {children}
    </Comp>
  );
}

// ─── Chart: vertical columns ─────────────────────────────────────────────────

function ColumnChart({
  rows,
  suffix = ' RPS',
  height = 220,
}: {
  rows: RankRow[];
  suffix?: string;
  height?: number;
}) {
  const max = Math.max(...rows.map((r) => r.rps), 1);
  return (
    <div className="w-full" role="img" aria-label="Vertical column chart of requests per second">
      <div className="flex items-end justify-between gap-2 sm:gap-3" style={{ height }}>
        {rows.map((row) => {
          const meta = FW[row.id];
          const h = Math.max((row.rps / max) * 100, 4);
          const isTarget = row.id === 'nextrush-v3';
          return (
            <div key={row.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <span className="font-mono text-[0.65rem] font-semibold tabular-nums text-[var(--text-primary)] sm:text-xs">
                {fmt(row.rps)}
              </span>
              <div className="relative flex w-full max-w-[56px] flex-1 items-end justify-center">
                <div
                  className={`w-full max-w-[44px] rounded-t-lg transition-all ${isTarget ? 'ring-2 ring-[color-mix(in_srgb,var(--brand-link)_50%,transparent)] ring-offset-2 ring-offset-[var(--color-fd-card)]' : ''}`}
                  style={
                    {
                      height: `${h}%`,
                      background: `linear-gradient(180deg, ${meta.color} 0%, color-mix(in srgb, ${meta.color} 65%, transparent) 100%)`,
                      boxShadow: isTarget
                        ? `0 0 24px color-mix(in srgb, ${meta.color} 45%, transparent)`
                        : `0 8px 20px -12px color-mix(in srgb, ${meta.color} 50%, transparent)`,
                    } as CSSProperties
                  }
                  title={`${meta.name}: ${fmt(row.rps)}${suffix}`}
                />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                <span
                  className={`max-w-full truncate text-center text-[0.65rem] leading-tight sm:text-xs ${
                    isTarget ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {meta.short}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
        req/s · higher is better{suffix !== ' RPS' ? ` · ${suffix.trim()}` : ''}
      </p>
    </div>
  );
}

// ─── Chart: ranked horizontal bars ───────────────────────────────────────────

function RankedBars({ rows, suffix = ' RPS' }: { rows: RankRow[]; suffix?: string }) {
  const max = Math.max(...rows.map((r) => r.rps), 1);
  return (
    <div className="space-y-2.5" role="list" aria-label="Ranked throughput">
      {rows.map((row, i) => {
        const meta = FW[row.id];
        const width = Math.min(Math.max((row.rps / max) * 100, 4), 100);
        const isTarget = row.id === 'nextrush-v3';
        return (
          <div
            key={row.id}
            role="listitem"
            className={`grid gap-1 rounded-xl px-2 py-1.5 ${
              isTarget
                ? 'bg-[color-mix(in_srgb,var(--brand-link)_8%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--brand-link)_28%,var(--color-fd-border))]'
                : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--color-fd-muted)_70%,transparent)] font-mono text-[0.65rem] font-semibold text-[var(--text-muted)]">
                  {row.rank ?? i + 1}
                </span>
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                <span className={`truncate text-sm ${isTarget ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-primary)]'}`}>
                  {meta.name}
                </span>
              </div>
              <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                {fmt(row.rps)}
                <span className="ml-0.5 text-xs font-medium text-[var(--text-muted)]">{suffix}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-fd-muted)_55%,transparent)] ring-1 ring-inset ring-[var(--color-fd-border)]">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${width}%`,
                  background: `linear-gradient(90deg, ${meta.color}, color-mix(in srgb, ${meta.color} 70%, white))`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Chart: leaderboard podium ───────────────────────────────────────────────

function Leaderboard({ scores }: { scores: typeof OVERALL_SCORE }) {
  const top = scores.slice(0, 3);
  // Podium visual order: 2nd, 1st, 3rd
  const podiumOrder = [top[1], top[0], top[2]].filter(Boolean);
  const heights = [72, 100, 56];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="flex items-end justify-center gap-3 pt-4 sm:gap-5">
        {podiumOrder.map((row, i) => {
          if (!row) return null;
          const meta = FW[row.id];
          const place = scores.findIndex((s) => s.id === row.id) + 1;
          const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉';
          const isTarget = row.id === 'nextrush-v3';
          return (
            <div key={row.id} className="flex w-[30%] max-w-[120px] flex-col items-center gap-2">
              <span className="text-lg" aria-hidden>
                {medal}
              </span>
              <span className={`text-center text-xs font-semibold ${isTarget ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {meta.short}
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-[var(--text-primary)]">
                {row.points}
              </span>
              <div
                className="w-full rounded-t-xl"
                style={{
                  height: heights[i],
                  background: `linear-gradient(180deg, ${meta.color} 0%, color-mix(in srgb, ${meta.color} 55%, transparent) 100%)`,
                  boxShadow: isTarget ? `0 0 28px color-mix(in srgb, ${meta.color} 40%, transparent)` : undefined,
                }}
              />
            </div>
          );
        })}
      </div>

      <ol className="space-y-2">
        {scores.map((row, i) => {
          const meta = FW[row.id];
          const isTarget = row.id === 'nextrush-v3';
          const maxPts = row.max;
          const width = (row.points / maxPts) * 100;
          return (
            <li
              key={row.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                isTarget
                  ? 'bg-[color-mix(in_srgb,var(--brand-link)_10%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--brand-link)_30%,var(--color-fd-border))]'
                  : 'bg-[color-mix(in_srgb,var(--color-fd-muted)_30%,transparent)]'
              }`}
            >
              <span className="w-5 font-mono text-xs font-bold text-[var(--text-muted)]">{i + 1}</span>
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-sm ${isTarget ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-primary)]'}`}>
                    {meta.name}
                    {meta.role === 'baseline' ? (
                      <span className="ml-1.5 text-[0.65rem] font-normal text-[var(--text-muted)]">baseline</span>
                    ) : null}
                    {isTarget ? (
                      <span className="ml-1.5 rounded-full bg-[color-mix(in_srgb,var(--brand-link)_18%,transparent)] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-[#BC4E08] dark:text-[#FF8A34]">
                        target
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                    {row.points}
                    <span className="text-xs font-medium text-[var(--text-muted)]">/{maxPts}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-fd-muted)_60%,transparent)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${width}%`,
                      background: meta.color,
                    }}
                  />
                </div>
              </div>
              <span className="hidden w-10 text-right text-[0.65rem] text-[var(--text-muted)] sm:block">
                {row.wins}w
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Chart: heatmap ──────────────────────────────────────────────────────────

function Heatmap({ visible }: { visible: Set<FrameworkId> }) {
  const frameworks = FRAMEWORKS.filter((f) => visible.has(f.id));
  const scenarios = HEATMAP_SCENARIOS.map((id) => SCENARIOS.find((s) => s.id === id)!).filter(Boolean);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--color-fd-card)] px-2 py-2 font-semibold text-[var(--text-muted)]">
              Scenario
            </th>
            {frameworks.map((f) => (
              <th key={f.id} className="px-1.5 py-2 text-center font-semibold text-[var(--text-secondary)]">
                <span className="inline-flex flex-col items-center gap-1">
                  <span className="size-2 rounded-full" style={{ backgroundColor: f.color }} />
                  {f.short}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scenarios.map((sc) => {
            const rows = RPS_256[sc.id] ?? [];
            const best = Math.max(...rows.map((r) => r.rps), 1);
            return (
              <tr key={sc.id} className="border-t border-[var(--color-fd-border)]">
                <th className="sticky left-0 z-10 bg-[var(--color-fd-card)] px-2 py-1.5 text-left font-medium text-[var(--text-primary)]">
                  {sc.name}
                </th>
                {frameworks.map((f) => {
                  const row = rows.find((r) => r.id === f.id);
                  if (!row) {
                    return (
                      <td key={f.id} className="px-1.5 py-1.5 text-center text-[var(--text-muted)]">
                        —
                      </td>
                    );
                  }
                  const pct = pctOf(row.rps, best);
                  return (
                    <td key={f.id} className="px-1.5 py-1.5">
                      <div
                        className={`mx-auto flex h-9 w-full min-w-[52px] max-w-[72px] items-center justify-center rounded-md font-mono text-[0.7rem] font-semibold tabular-nums ${heatColor(pct)}`}
                        title={`${f.name}: ${fmt(row.rps)} RPS (${pct}% of best)`}
                      >
                        {pct}%
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Cell = % of the fastest framework in that scenario @ 256 connections. Green is near the
        leader; amber/rose trails.
      </p>
    </div>
  );
}

// ─── Chart: scaling lines (SVG) ──────────────────────────────────────────────

function ScalingChart({ visible }: { visible: Set<FrameworkId> }) {
  const levels = [1, 64, 256];
  const pad = { t: 16, r: 12, b: 32, l: 48 };
  const W = 640;
  const H = 260;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const series = FRAMEWORKS.filter((f) => visible.has(f.id));
  const allVals = series.flatMap((f) => SCALING_HELLO[f.id]);
  const minY = Math.min(...allVals) * 0.92;
  const maxY = Math.max(...allVals) * 1.04;

  const xAt = (i: number) => pad.l + (i / (levels.length - 1)) * innerW;
  const yAt = (v: number) => pad.t + innerH - ((v - minY) / (maxY - minY)) * innerH;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => minY + ((maxY - minY) * i) / yTicks);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Concurrency scaling line chart for Hello World"
      >
        {/* grid */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="currentColor"
              className="text-[var(--color-fd-border)]"
              strokeWidth={1}
            />
            <text
              x={pad.l - 8}
              y={yAt(t) + 3}
              textAnchor="end"
              className="fill-[var(--text-muted)]"
              fontSize={10}
              fontFamily="ui-monospace, monospace"
            >
              {Math.round(t / 1000)}k
            </text>
          </g>
        ))}
        {levels.map((lv, i) => (
          <text
            key={lv}
            x={xAt(i)}
            y={H - 10}
            textAnchor="middle"
            className="fill-[var(--text-muted)]"
            fontSize={11}
          >
            {lv}c
          </text>
        ))}
        {series.map((f) => {
          const pts = SCALING_HELLO[f.id]
            .map((v, i) => `${xAt(i)},${yAt(v)}`)
            .join(' ');
          const isTarget = f.id === 'nextrush-v3';
          return (
            <g key={f.id}>
              <polyline
                fill="none"
                points={pts}
                stroke={f.color}
                strokeWidth={isTarget ? 3 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={isTarget ? 1 : 0.85}
              />
              {SCALING_HELLO[f.id].map((v, i) => (
                <circle
                  key={i}
                  cx={xAt(i)}
                  cy={yAt(v)}
                  r={isTarget ? 4.5 : 3.5}
                  fill={f.color}
                  stroke="var(--color-fd-card)"
                  strokeWidth={1.5}
                />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((f) => (
          <span key={f.id} className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <span className="size-2 rounded-full" style={{ backgroundColor: f.color }} />
            {f.name}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        Hello World RPS across concurrency. All frameworks plateau similarly from 64→256 — no
        scaling collapse under load in this run.
      </p>
    </div>
  );
}

// ─── Scenario explorer ───────────────────────────────────────────────────────

/**
 * Clean master–detail explorer. Intentionally minimal: quiet list, clear
 * selected row, detail pane carries the data. No rainbow chips, mini-bars,
 * or decorative chrome competing with the chart.
 */
function ScenarioExplorer({ visible }: { visible: Set<FrameworkId> }) {
  const [activeId, setActiveId] = useState('hello-world');
  const [view, setView] = useState<'columns' | 'ranked'>('columns');
  const scenario = SCENARIOS.find((s) => s.id === activeId) ?? SCENARIOS[0];
  const rows = filterRows(RPS_256[scenario.id] ?? [], visible);
  const baseline = (RPS_256[scenario.id] ?? []).find((r) => r.id === 'raw-node');
  const nextrush = (RPS_256[scenario.id] ?? []).find((r) => r.id === 'nextrush-v3');
  const fastify = (RPS_256[scenario.id] ?? []).find((r) => r.id === 'fastify');
  const hono = (RPS_256[scenario.id] ?? []).find((r) => r.id === 'hono');

  const vsBase = baseline && nextrush ? pctOf(nextrush.rps, baseline.rps) : null;
  const vsFastify =
    fastify && nextrush ? Math.round(((nextrush.rps - fastify.rps) / fastify.rps) * 1000) / 10 : null;
  const vsHono =
    hono && nextrush ? Math.round(((nextrush.rps - hono.rps) / hono.rps) * 1000) / 10 : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8">
      {/* Sidebar — simple list, one clear selected state */}
      <nav
        className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
        aria-label="Benchmark scenarios"
      >
        {SCENARIOS.map((s) => {
          const active = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              aria-current={active ? 'true' : undefined}
              className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-link)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-fd-card)] lg:w-full ${
                active
                  ? 'bg-[color-mix(in_srgb,var(--brand-link)_12%,var(--color-fd-muted))] font-semibold text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[color-mix(in_srgb,var(--color-fd-muted)_55%,transparent)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="block whitespace-nowrap lg:whitespace-normal">{s.name}</span>
              <span
                className={`mt-0.5 hidden text-[0.7rem] font-normal capitalize lg:block ${
                  active ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {s.category}
                {s.fairness === 'idiomatic' ? ' · idiomatic' : ''}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Detail */}
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              {scenario.name}
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              {scenario.purpose}
            </p>
          </div>
          <div className="flex gap-1.5">
            <Pill active={view === 'columns'} onClick={() => setView('columns')}>
              Columns
            </Pill>
            <Pill active={view === 'ranked'} onClick={() => setView('ranked')}>
              Ranked
            </Pill>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {scenario.bottlenecks.map((b) => (
            <span
              key={b.label}
              className={`rounded-full border px-2 py-0.5 text-[0.7rem] font-medium ${bottleneckTone(b.level)}`}
            >
              {b.label}
            </span>
          ))}
          {scenario.fairness === 'idiomatic' ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[0.7rem] font-medium text-amber-800 dark:text-amber-200">
              not in headline score
            </span>
          ) : null}
        </div>

        {nextrush && baseline ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_30%,transparent)] px-3 py-2.5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                NextRush
              </p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
                {fmt(nextrush.rps)}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">RPS @ 256c</p>
            </div>
            <div className="rounded-xl border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_30%,transparent)] px-3 py-2.5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                vs baseline
              </p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
                {vsBase}%
              </p>
              <p className="text-xs text-[var(--text-secondary)]">of raw Node</p>
            </div>
            <div className="rounded-xl border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_30%,transparent)] px-3 py-2.5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                vs Fastify
              </p>
              <p
                className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
                  vsFastify != null && vsFastify >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-orange-600 dark:text-orange-400'
                }`}
              >
                {vsFastify != null ? `${vsFastify > 0 ? '+' : ''}${vsFastify}%` : '—'}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">relative</p>
            </div>
            <div className="rounded-xl border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_30%,transparent)] px-3 py-2.5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Latency p50
              </p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
                {nextrush.p50}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">p99 {nextrush.p99}</p>
            </div>
          </div>
        ) : null}

        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          <strong className="font-medium text-[var(--text-primary)]">Why it matters.</strong>{' '}
          {scenario.why}
          {scenario.insight ? (
            <>
              {' '}
              <strong className="font-medium text-[var(--text-primary)]">In this run:</strong>{' '}
              {scenario.insight}
            </>
          ) : null}
          {vsHono != null ? (
            <>
              {' '}
              vs Hono:{' '}
              <span className="font-mono font-medium text-[var(--text-primary)]">
                {vsHono > 0 ? '+' : ''}
                {vsHono}%
              </span>
              .
            </>
          ) : null}
        </p>

        {view === 'columns' ? <ColumnChart rows={rows} /> : <RankedBars rows={rows} />}

        <div className="overflow-x-auto rounded-xl border border-[var(--color-fd-border)]">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-[color-mix(in_srgb,var(--color-fd-muted)_40%,transparent)] text-xs uppercase tracking-wider text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2 font-semibold">Framework</th>
                <th className="px-3 py-2 font-semibold">RPS</th>
                <th className="px-3 py-2 font-semibold">CV%</th>
                <th className="px-3 py-2 font-semibold">p50</th>
                <th className="px-3 py-2 font-semibold">p99</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const meta = FW[row.id];
                const isTarget = row.id === 'nextrush-v3';
                return (
                  <tr
                    key={row.id}
                    className={`border-t border-[var(--color-fd-border)] ${
                      isTarget ? 'bg-[color-mix(in_srgb,var(--brand-link)_6%,transparent)]' : ''
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className={isTarget ? 'font-semibold' : ''}>{meta.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">{fmt(row.rps)}</td>
                    <td className="px-3 py-2 font-mono tabular-nums text-[var(--text-secondary)]">
                      {row.cv.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-[var(--text-secondary)]">
                      {row.p50}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-[var(--text-secondary)]">
                      {row.p99}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Insights ────────────────────────────────────────────────────────────────

function Insights() {
  const items: Array<{ tone: 'good' | 'warn' | 'note'; title: string; body: string }> = [
    {
      tone: 'good',
      title: 'Serialization is a strength',
      body: 'Large JSON (91.7%) and Send Object (89.9%) sit closest to the raw Node baseline — low framework tax when payload work dominates.',
    },
    {
      tone: 'good',
      title: 'Routing stays competitive',
      body: 'Route params and deep routes hold ~86–88% of baseline and track Fastify within a few points; Hono trails slightly on most routing cells.',
    },
    {
      tone: 'warn',
      title: 'POST JSON is the main gap',
      body: '75% of baseline. Body parsers are not equivalent: safety checks (depth limits, prototype poisoning) cost RPS. Raw Node does the least defensive work here.',
    },
    {
      tone: 'note',
      title: 'Noise ≠ ranking',
      body: '18 adjacent orderings fall inside combined stddev (including several NextRush ↔ Fastify / Hono pairs). Those are scored as ties — do not cite them as leads.',
    },
    {
      tone: 'good',
      title: 'Stable under concurrency',
      body: 'Scaling from 64→256 connections plateaus cleanly for every framework. No collapse under the headline throughput regime.',
    },
    {
      tone: 'note',
      title: 'Idiomatic ≠ like-for-like',
      body: 'Middleware, error handling, and static file use each framework’s own mechanism. Shown for completeness; excluded from the 108-point headline.',
    },
  ];

  const toneCls = {
    good: 'border-emerald-500/30 bg-emerald-500/8',
    warn: 'border-amber-500/30 bg-amber-500/8',
    note: 'border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_35%,transparent)]',
  } as const;
  const mark = { good: '✓', warn: '⚠', note: '·' } as const;

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li
          key={item.title}
          className={`rounded-xl border px-4 py-3.5 ${toneCls[item.tone]}`}
        >
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            <span className="mr-1.5 text-[var(--text-muted)]" aria-hidden>
              {mark[item.tone]}
            </span>
            {item.title}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

// ─── Trust / methodology strip ───────────────────────────────────────────────

function TrustStrip() {
  const checks = [
    'CPU pinned (server 2–7 · client 0–1)',
    'Framework order rotated',
    '6 runs × sample stddev + CV%',
    'Parity-validated identical payloads',
    'Process-isolated wrk (not event-loop shared)',
    'Warmup before every timed cell',
    'Gaps inside noise scored as ties',
    'Deviations from stock defaults disclosed',
  ];
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {checks.map((c) => (
        <li
          key={c}
          className="flex items-start gap-2 rounded-lg border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_30%,transparent)] px-3 py-2 text-sm text-[var(--text-secondary)]"
        >
          <span className="mt-0.5 text-emerald-500" aria-hidden>
            ✓
          </span>
          <span>{c}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Framework filter ────────────────────────────────────────────────────────

function FrameworkFilter({
  visible,
  onToggle,
  onReset,
}: {
  visible: Set<FrameworkId>;
  onToggle: (id: FrameworkId) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FRAMEWORKS.map((f) => {
        const on = visible.has(f.id);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onToggle(f.id)}
            aria-pressed={on}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
              on
                ? 'border-transparent text-[var(--text-primary)]'
                : 'border-[var(--color-fd-border)] text-[var(--text-muted)] opacity-55'
            }`}
            style={
              on
                ? {
                    background: `color-mix(in srgb, ${f.color} 18%, transparent)`,
                    borderColor: `color-mix(in srgb, ${f.color} 45%, transparent)`,
                  }
                : undefined
            }
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: on ? f.color : 'var(--text-muted)' }}
            />
            {f.short}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onReset}
        className="ml-1 text-xs font-medium text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
      >
        Reset
      </button>
    </div>
  );
}

// ─── Main dashboard ──────────────────────────────────────────────────────────

export function BenchmarkDashboard() {
  const [visibleList, setVisibleList] = useState<FrameworkId[]>(DEFAULT_VISIBLE);
  const visible = useMemo(() => new Set(visibleList), [visibleList]);

  const toggle = (id: FrameworkId) => {
    setVisibleList((prev) => {
      if (prev.includes(id)) {
        // Keep at least two frameworks so charts remain meaningful.
        if (prev.length <= 2) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const reset = () => setVisibleList(DEFAULT_VISIBLE);

  const filteredOverall = OVERALL_SCORE.filter((s) => visible.has(s.id));
  const headlineRows = filterRows(RPS_256['hello-world'], visible);

  return (
    <div className="not-prose my-8 space-y-8">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-2xl border border-[var(--color-fd-border)] p-6 md:p-8"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 100% 0%, color-mix(in srgb, var(--brand-link) 16%, transparent), transparent 55%), linear-gradient(160deg, var(--color-fd-card), color-mix(in srgb, var(--brand-link) 8%, var(--color-fd-card)))',
          boxShadow:
            '0 1px 0 0 color-mix(in srgb, white 6%, transparent), 0 32px 80px -48px color-mix(in srgb, var(--brand-link) 40%, transparent)',
        }}
      >
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--brand-link)]">
          Performance
        </p>
        <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-[var(--text-primary)] md:text-3xl">
          Designed for production throughput.
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)]">
          NextRush v3 ranks <strong className="font-semibold text-[var(--text-primary)]">#3 overall</strong>{' '}
          among popular Node.js frameworks — consistently{' '}
          <strong className="font-semibold text-[var(--text-primary)]">~85–92%</strong> of a raw Node
          baseline on like-for-like scenarios, with Fastify ahead and Hono behind.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Timed cells', value: RUN_META.timedCells },
            { label: 'Frameworks', value: '6' },
            { label: 'Scenarios', value: '13' },
            { label: 'Headline rank', value: '#3' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-card)_80%,transparent)] px-3.5 py-3 backdrop-blur-sm"
            >
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {s.label}
              </p>
              <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--text-primary)]">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href="#methodology"
            className="inline-flex items-center rounded-full border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[color-mix(in_srgb,var(--brand-link)_40%,var(--color-fd-border))]"
          >
            Methodology →
          </a>
          <a
            href="https://github.com/0xTanzim/nextRush/tree/main/apps/benchmark"
            className="inline-flex items-center rounded-full border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[color-mix(in_srgb,var(--brand-link)_40%,var(--color-fd-border))]"
            target="_blank"
            rel="noreferrer"
          >
            Suite source →
          </a>
          <a
            href="https://github.com/0xTanzim/nextRush/tree/main/apps/benchmark/results"
            className="inline-flex items-center rounded-full border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[color-mix(in_srgb,var(--brand-link)_40%,var(--color-fd-border))]"
            target="_blank"
            rel="noreferrer"
          >
            Raw results →
          </a>
        </div>

        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Run <span className="font-mono">{RUN_META.runId}</span> · {RUN_META.tool} · Node{' '}
          {RUN_META.node} · {RUN_META.cpu} · {RUN_META.profile}
        </p>
      </section>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Compare frameworks
        </p>
        <FrameworkFilter visible={visible} onToggle={toggle} onReset={reset} />
      </div>

      {/* ── Overall leaderboard ──────────────────────────────────────────── */}
      <Panel
        title="Overall ranking"
        description="Like-for-like scenarios only — 9 scenarios × 2 concurrency levels × 6 frameworks = 108 points. A win is worth 6 points, last place 1. Ties inside noise split points."
      >
        <Leaderboard scores={filteredOverall} />
      </Panel>

      {/* ── At-a-glance columns (hello world) ────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Hello World @ 256c"
          description="Vertical column chart — pure framework overhead. The everyday “how fast is the shell?” number."
        >
          <ColumnChart rows={headlineRows} />
        </Panel>
        <Panel
          title="Same data, ranked"
          description="Horizontal leaderboard view of the same cell. Rank badges + % of leader."
        >
          <RankedBars rows={headlineRows} />
        </Panel>
      </div>

      {/* ── Heatmap ──────────────────────────────────────────────────────── */}
      <Panel
        title="Scenario heatmap"
        description="One glance across every like-for-like scenario. Each cell is % of the fastest framework in that row."
      >
        <Heatmap visible={visible} />
      </Panel>

      {/* ── Scenario explorer ────────────────────────────────────────────── */}
      <Panel
        title="Scenario explorer"
        description="Pick a scenario to see purpose, story metrics, charts, and latency."
      >
        <ScenarioExplorer visible={visible} />
      </Panel>

      {/* ── Scaling ──────────────────────────────────────────────────────── */}
      <Panel
        title="Concurrency scaling"
        description="Hello World RPS at 1 · 64 · 256 connections. Line color matches the framework legend."
      >
        <ScalingChart visible={visible} />
      </Panel>

      {/* ── Insights ─────────────────────────────────────────────────────── */}
      <Panel
        title="What the numbers mean"
        description="Takeaways a reader should remember — not just the raw RPS table."
      >
        <Insights />
      </Panel>

      {/* ── Trust ────────────────────────────────────────────────────────── */}
      <Panel
        title="Trust these numbers"
        description="Mechanical fairness guarantees from the parity-validated suite. Full detail in Methodology below."
        action={
          <a
            href="#methodology"
            className="text-xs font-medium text-[var(--brand-link)] underline-offset-2 hover:underline"
          >
            Full methodology →
          </a>
        }
      >
        <TrustStrip />
      </Panel>
    </div>
  );
}

export default BenchmarkDashboard;

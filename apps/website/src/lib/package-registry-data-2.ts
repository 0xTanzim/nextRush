/**
 * Package registry data, part 2 of 2 — Responses, Observability,
 * Real-time & Events, Adapters, Ecosystem, Tooling clusters.
 *
 * Provenance: this is the single source of truth for all publishable
 * NextRush packages under packages/**. Feeds the /packages catalog,
 * sidebar capability clusters, type/status badges, and the agent
 * endpoints (llms.txt, agent-spec.json). Every entry across part 1 and
 * part 2 must correspond to a real, non-private package.json — enforced
 * by `pnpm docs:verify-registry` (apps/website/scripts/verify-registry-parity.ts),
 * never by hand-checking.
 *
 * `@nextrush/adapter-conformance` is intentionally excluded — it is
 * `"private": true` (a test-only cross-adapter conformance suite, never
 * published to npm).
 *
 * Do not hand-edit `sinceVersion` — copy it from the package's own
 * package.json `version` field so it never drifts from what actually ships.
 */

import type { PackageEntry } from './package-registry-types';

export const packageRegistryDataPart2: readonly PackageEntry[] = [
  // ---- Responses ------------------------------------------------------------
  {
    name: '@nextrush/compression',
    category: 'Responses',
    type: 'Middleware',
    status: 'Stable',
    summary: 'Response compression middleware with Gzip, Brotli, and Deflate support.',
    sinceVersion: '3.1.0',
  },
  {
    name: '@nextrush/static',
    category: 'Responses',
    type: 'Middleware',
    status: 'Stable',
    summary: 'Static file serving middleware.',
    sinceVersion: '1.0.0',
  },
  {
    name: '@nextrush/template',
    category: 'Responses',
    type: 'Middleware',
    status: 'Stable',
    summary: 'Template rendering engine with helpers, partials, layouts, and streaming.',
    sinceVersion: '1.0.0',
  },
  {
    name: '@nextrush/openapi',
    category: 'Responses',
    type: 'Middleware',
    status: 'Stable',
    summary: 'Zero-config OpenAPI 3.1 generation from route validation metadata.',
    sinceVersion: '1.0.0',
  },

  // ---- Observability ------------------------------------------------------
  {
    name: '@nextrush/logger',
    category: 'Observability',
    type: 'Middleware',
    status: 'Stable',
    summary: 'Structured request logging middleware.',
    sinceVersion: '1.0.0',
  },
  {
    name: '@nextrush/request-id',
    category: 'Observability',
    type: 'Middleware',
    status: 'Stable',
    summary: 'Request ID generation middleware for distributed tracing and correlation.',
    sinceVersion: '1.0.0',
  },
  {
    name: '@nextrush/timer',
    category: 'Observability',
    type: 'Middleware',
    status: 'Stable',
    summary: 'Response time tracking middleware.',
    sinceVersion: '1.0.0',
  },
  {
    name: '@nextrush/health',
    category: 'Observability',
    type: 'Middleware',
    status: 'Stable',
    summary: 'Liveness/readiness health check endpoints for orchestrator probes (Kubernetes, PM2, systemd).',
    sinceVersion: '1.0.0',
  },

  // ---- Real-time & Events --------------------------------------------------
  {
    name: '@nextrush/events',
    category: 'Real-time & Events',
    type: 'Extension',
    status: 'Stable',
    summary: 'Type-safe, async-ready event emitter registered as a long-lived app extension.',
    sinceVersion: '1.0.0',
  },
  {
    name: '@nextrush/websocket',
    category: 'Real-time & Events',
    type: 'Extension',
    status: 'Stable',
    summary: 'WebSocket support with rooms, broadcasting, and a factory + middleware API.',
    sinceVersion: '1.0.0',
  },

  // ---- Adapters -------------------------------------------------------------
  {
    name: '@nextrush/adapter-node',
    category: 'Adapters',
    type: 'Adapter',
    status: 'Stable',
    summary: 'Node.js HTTP adapter — the default runtime target.',
    sinceVersion: '3.1.0',
  },
  {
    name: '@nextrush/adapter-bun',
    category: 'Adapters',
    type: 'Adapter',
    status: 'Stable',
    summary: 'Bun HTTP adapter.',
    sinceVersion: '1.0.0',
  },
  {
    name: '@nextrush/adapter-deno',
    category: 'Adapters',
    type: 'Adapter',
    status: 'Stable',
    summary: 'Deno HTTP adapter.',
    sinceVersion: '1.0.0',
  },
  {
    name: '@nextrush/adapter-edge',
    category: 'Adapters',
    type: 'Adapter',
    status: 'Stable',
    summary: 'Edge runtime adapter for Cloudflare Workers, Vercel Edge, and similar platforms.',
    sinceVersion: '1.0.0',
  },
  {
    name: '@nextrush/adapter-serverless',
    category: 'Adapters',
    type: 'Adapter',
    status: 'Stable',
    summary: 'Serverless adapter for AWS Lambda, API Gateway, GCF, and Azure via a generic event-mapper registry.',
    sinceVersion: '1.0.0',
  },

  // ---- Tooling ----------------------------------------------------------------
  {
    name: '@nextrush/dev',
    category: 'Tooling',
    type: 'Tool',
    status: 'Stable',
    summary: 'Hot reload dev server, production builds, and code generators — multi-runtime.',
    sinceVersion: '1.0.0',
  },
  {
    name: 'create-nextrush',
    category: 'Tooling',
    type: 'Tool',
    status: 'Stable',
    summary: 'Interactive project scaffolder for new NextRush applications.',
    sinceVersion: '1.0.0',
  },
// ---- Ecosystem --------------------------------------------------------------
  {
    name: '@nextrush/express-bridge',
    category: 'Ecosystem',
    type: 'Middleware',
    status: 'New',
    summary: 'Opt-in bridge that adapts Express/Connect 3-arity middleware into NextRush middleware (Node-shaped raw HTTP only).',
    sinceVersion: '0.1.0',
  },
] as const;

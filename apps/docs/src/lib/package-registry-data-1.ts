/**
 * Package registry data, part 1 of 2 — Core, Class Runtime, Security,
 * Request Data clusters. See package-registry-data-2.ts for the rest and
 * package-registry-data.ts for the combined export.
 *
 * See package-registry-data-2.ts header for the full provenance note
 * (parity script, private-package exclusion, sinceVersion rule).
 */

import type { PackageEntry } from './package-registry-types';

export const packageRegistryDataPart1: readonly PackageEntry[] = [
  // ---- Core -----------------------------------------------------------
  {
    name: 'nextrush',
    category: 'Core',
    type: 'Core',
    status: 'Stable',
    summary: 'Meta package that re-exports the core framework and the class runtime subpath.',
    sinceVersion: '3.1.0',
  },
  {
    name: '@nextrush/core',
    category: 'Core',
    type: 'Core',
    status: 'Stable',
    summary: 'Application, Context, and middleware composition — the framework entry point.',
    sinceVersion: '3.1.0',
  },
  {
    name: '@nextrush/router',
    category: 'Core',
    type: 'Core',
    status: 'Stable',
    summary: 'Segment trie router with O(k) lookup regardless of route count.',
    sinceVersion: '3.1.0',
  },
  {
    name: '@nextrush/types',
    category: 'Core',
    type: 'Core',
    status: 'Stable',
    summary: 'Shared TypeScript types used across every NextRush package.',
    sinceVersion: '3.1.0',
  },
  {
    name: '@nextrush/errors',
    category: 'Core',
    type: 'Core',
    status: 'Stable',
    summary: 'Standardized HTTP error class hierarchy for the whole framework.',
    sinceVersion: '3.1.0',
  },
  {
    name: '@nextrush/runtime',
    category: 'Core',
    type: 'Core',
    status: 'Stable',
    summary: 'Runtime detection and cross-runtime abstractions used by adapters.',
    sinceVersion: '3.1.0',
  },
  {
    name: '@nextrush/stream',
    category: 'Core',
    type: 'Core',
    status: 'Stable',
    summary: 'Runtime-agnostic response streaming (text, SSE, NDJSON) for AI/agentic apps.',
    sinceVersion: '3.1.0',
  },

  // ---- Class Runtime ----------------------------------------------------
  {
    name: '@nextrush/class',
    category: 'Class Runtime',
    type: 'Core',
    status: 'Stable',
    summary:
      'Consolidated class runtime — decorators, DI re-export, controllers, modules, guards, interceptors, filters, and lifecycle hooks.',
    sinceVersion: '3.1.0',
  },
  {
    name: '@nextrush/di',
    category: 'Class Runtime',
    type: 'Core',
    status: 'Stable',
    summary: 'Lightweight dependency injection container wrapping tsyringe.',
    sinceVersion: '3.1.0',
  },
  {
    name: '@nextrush/testing',
    category: 'Class Runtime',
    type: 'Tool',
    status: 'Stable',
    summary: 'Test harness with DI isolation for class-based controllers and services.',
    sinceVersion: '1.0.0',
  },
  {
    name: '@nextrush/decorators',
    category: 'Class Runtime',
    type: 'Core',
    status: 'Deprecated',
    summary:
      'Compatibility shim for the former standalone decorators package — use @nextrush/class.',
    sinceVersion: '3.1.0',
  },
  {
    name: '@nextrush/controllers',
    category: 'Class Runtime',
    type: 'Core',
    status: 'Deprecated',
    summary:
      'Compatibility shim for the former standalone controller registrar — use @nextrush/class.',
    sinceVersion: '3.1.0',
  },

  // ---- Security -----------------------------------------------------------
  {
    name: '@nextrush/helmet',
    category: 'Security',
    type: 'Middleware',
    status: 'Stable',
    summary: 'Security headers middleware (CSP, HSTS, X-Content-Type-Options, and more).',
    sinceVersion: '3.1.0',
  },
  {
    name: '@nextrush/cors',
    category: 'Security',
    type: 'Middleware',
    status: 'Stable',
    summary: 'CORS header middleware with configurable origin, method, and header allow-lists.',
    sinceVersion: '3.1.0',
  },
  {
    name: '@nextrush/csrf',
    category: 'Security',
    type: 'Middleware',
    status: 'Stable',
    summary: 'CSRF protection via the signed double-submit cookie pattern with HMAC-SHA256.',
    sinceVersion: '1.0.0',
  },
  {
    name: '@nextrush/rate-limit',
    category: 'Security',
    type: 'Middleware',
    status: 'Stable',
    summary: 'Rate limiting middleware with token-bucket and sliding-window algorithms.',
    sinceVersion: '1.0.0',
  },

  // ---- Request Data --------------------------------------------------------
  {
    name: '@nextrush/body-parser',
    category: 'Request Data',
    type: 'Middleware',
    status: 'Stable',
    summary: 'JSON, form, and text request body parsing middleware.',
    sinceVersion: '3.1.0',
  },
  {
    name: '@nextrush/multipart',
    category: 'Request Data',
    type: 'Middleware',
    status: 'Stable',
    summary: 'Streaming multipart/form-data parser and file upload middleware.',
    sinceVersion: '1.0.0',
  },
  {
    name: '@nextrush/cookies',
    category: 'Request Data',
    type: 'Middleware',
    status: 'Stable',
    summary: 'Cookie parsing and serialization middleware.',
    sinceVersion: '1.0.0',
  },
  {
    name: '@nextrush/validation',
    category: 'Request Data',
    type: 'Middleware',
    status: 'Stable',
    summary:
      'Standard Schema request validation middleware — works with Zod, Valibot, and ArkType.',
    sinceVersion: '1.0.0',
  },
] as const;

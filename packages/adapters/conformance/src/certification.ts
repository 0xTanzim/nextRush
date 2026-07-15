/**
 * Runtime certification matrix (task group 9).
 *
 * A feature × runtime coverage matrix **derived** from the same capability data
 * the conformance suite validates — never hand-maintained:
 *   - per-runtime {@link RuntimeCapabilities} from `capabilitiesFor()` (group 2),
 *   - the conformance driver capability flags (`handlerTimeout504`,
 *     `teardownOnShutdown`, `transportAbortFiresSignal`) that the suite asserts.
 *
 * Flip any of those inputs and both a conformance test AND this matrix change —
 * that coupling is what makes the matrix a real certification, not a claim.
 *
 * @packageDocumentation
 */

import { capabilitiesFor } from '@nextrush/runtime';
import type { Runtime } from '@nextrush/types';
import { drivers } from './drivers';

/** The features the matrix certifies (task 9.1). */
export const FEATURES = [
  'Request',
  'Streaming',
  'AbortSignal',
  'Cookies',
  'Multipart',
  'SSE',
  'Compression',
  'WebSockets',
  'Shutdown',
  'Timeouts',
] as const;
export type Feature = (typeof FEATURES)[number];

/** Support level for a feature on a runtime. */
export type Support = 'full' | 'partial' | 'na' | 'none';

/** The capability inputs the matrix is computed from (one per conformance target). */
export interface CertInput {
  readonly name: string;
  readonly capabilities: ReturnType<typeof capabilitiesFor>;
  readonly handlerTimeout504: boolean;
  readonly teardownOnShutdown: boolean;
  readonly transportAbortFiresSignal: boolean;
}

/** Map a conformance-driver name to the runtime whose capabilities it deploys on. */
const RUNTIME_OF: Record<string, Runtime> = {
  node: 'node',
  bun: 'bun',
  deno: 'deno',
  edge: 'cloudflare-workers',
  serverless: 'node', // AWS Lambda / GCF / Azure run on Node
};

/** Derive a single feature's support level from the capability inputs. */
export function featureSupport(feature: Feature, input: CertInput): Support {
  const c = input.capabilities;
  switch (feature) {
    case 'Request':
    case 'Cookies':
      return 'full'; // Web-standard baseline, uniform across runtimes
    case 'Streaming':
    case 'SSE':
    case 'Multipart':
      return c.webStreams ? 'full' : 'none';
    case 'Compression':
      return c.webStreams || c.nodeStreams ? 'full' : 'none';
    case 'WebSockets':
      return c.webSocket ? 'full' : 'none';
    case 'AbortSignal':
      // ctx.signal always fires on timeout; a mid-request TRANSPORT abort is the
      // discriminator (serverless is buffered → timeout-only = partial).
      return input.transportAbortFiresSignal ? 'full' : 'partial';
    case 'Shutdown':
      // Server-lifetime adapters tear down; edge/serverless have no lifetime →
      // not-applicable by design (excluded from coverage, not a failure).
      return input.teardownOnShutdown ? 'full' : 'na';
    case 'Timeouts':
      // 504 handler-timeout vs Node's socket-level timeout (a real model diff).
      return input.handlerTimeout504 ? 'full' : 'partial';
  }
}

const WEIGHT: Record<Support, number> = { full: 1, partial: 0.5, none: 0, na: 0 };

/** Coverage % for a runtime: weighted score over APPLICABLE (non-`na`) features. */
export function coverageOf(input: CertInput): number {
  let score = 0;
  let applicable = 0;
  for (const feature of FEATURES) {
    const support = featureSupport(feature, input);
    if (support === 'na') continue;
    applicable += 1;
    score += WEIGHT[support];
  }
  return Math.round((score / applicable) * 1000) / 10; // one decimal place
}

/** Build the certification inputs from the live conformance drivers. */
export function certInputs(): CertInput[] {
  return drivers.map((d) => ({
    name: d.name,
    capabilities: capabilitiesFor(RUNTIME_OF[d.name] ?? 'unknown'),
    handlerTimeout504: d.handlerTimeout504,
    teardownOnShutdown: d.teardownOnShutdown,
    transportAbortFiresSignal: d.transportAbortFiresSignal,
  }));
}

const CELL: Record<Support, string> = { full: '✅', partial: '⚠️', na: '➖', none: '❌' };

/** Render the certification matrix as user-facing Markdown (task 9.3). */
export function renderCertificationMarkdown(): string {
  const inputs = certInputs();
  const header = `| Feature | ${inputs.map((i) => i.name).join(' | ')} |`;
  const sep = `| --- | ${inputs.map(() => '---').join(' | ')} |`;
  const rows = FEATURES.map((feature) => {
    const cells = inputs.map((i) => CELL[featureSupport(feature, i)]);
    return `| ${feature} | ${cells.join(' | ')} |`;
  });
  const coverage = `| **Coverage** | ${inputs.map((i) => `**${String(coverageOf(i))}%**`).join(' | ')} |`;

  return [
    '# NextRush Runtime Certification Matrix',
    '',
    '> **Generated — do not edit by hand.** Regenerate with',
    '> `pnpm --filter @nextrush/adapter-conformance cert:matrix`.',
    '> Derived from the capability profiles (`capabilitiesFor()`) and the',
    '> cross-adapter conformance driver flags — the same data the conformance',
    '> suite asserts. A capability regression drops the affected runtime here.',
    '',
    'Legend: ✅ full · ⚠️ partial (different model) · ➖ not applicable by design · ❌ unsupported',
    '',
    header,
    sep,
    ...rows,
    coverage,
    '',
    '## Notes',
    '',
    '- **Timeouts** — ⚠️ for `node`: enforced at the socket level (`server.timeout`),',
    '  not a 504. Bun/Deno/Edge/serverless race the handler and return 504 (F-08).',
    '- **AbortSignal** — ⚠️ for `serverless`: the platform delivers a buffered event,',
    '  so there is no mid-request transport abort; `ctx.signal` still fires on timeout.',
    '- **Shutdown** — ➖ for `edge`/`serverless`: no server lifetime, so extension',
    "  `destroy()` never runs (F-14). Excluded from coverage rather than scored as a failure.",
    '',
  ].join('\n');
}

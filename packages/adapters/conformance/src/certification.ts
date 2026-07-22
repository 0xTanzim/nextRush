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

/**
 * Support level for a feature on a runtime.
 *
 * @remarks
 * `full` and `partial` require at least one EXECUTED cross-adapter conformance
 * assertion for that feature on that runtime (F-02) — see {@link TESTED_FEATURES}.
 * `capability-only` is a feature whose support is inferred solely from a
 * `capabilitiesFor()` bit with no executed behavioral assertion backing it; it
 * is excluded from the `full`/`proven` count and MUST NOT display the green
 * "proven" marker (a capability claim is not a conformance proof).
 */
export type Support = 'full' | 'partial' | 'capability-only' | 'na' | 'none';

/**
 * Features with at least one executed cross-adapter conformance assertion
 * (F-02). A feature NOT in this set is answered by capability data alone and
 * is capped at `capability-only`, never `full`/`partial`, regardless of what
 * the capability bits say — closing the "claim outruns proof" gap the runtime
 * platform review (F-02) identified for Streaming/SSE/Multipart/Compression/
 * WebSockets.
 *
 * Streaming and SSE graduated to executed assertions (`#20` in
 * `packages/adapters/conformance/src/suite.ts`, exercising `ctx.stream()` /
 * `ctx.sse()` across every driver). `Timeouts`/`AbortSignal`/`Shutdown` are
 * driven by driver-declared flags (`handlerTimeout504`, `transportAbortFires
 * Signal`, `teardownOnShutdown`) that are themselves asserted against real
 * behavior in `#13`/`#15`/`#18` — a flag-driven feature counts as tested
 * because the flag's truth is verified, not merely declared. Multipart and
 * Compression have no such assertion yet and are intentionally NOT in this
 * set; WebSockets has no adapter implementation at all.
 */
const TESTED_FEATURES: ReadonlySet<Feature> = new Set([
  'Request',
  'Cookies',
  'Streaming',
  'SSE',
  'AbortSignal',
  'Shutdown',
  'Timeouts',
]);

/**
 * Whether a target's certification result comes from execution on the real
 * runtime, or from the in-process driver simulation (task group 6, R5).
 *
 * The in-process conformance suite (`drivers/`) is ALWAYS a simulation — it
 * runs entirely under Node/vitest, by construction, regardless of which
 * driver is selected (`web-driver.ts` backs `bun`/`deno`/`edge` identically).
 * `real-runtime` is asserted here only when a SEPARATE real-runtime runner
 * exists and actually executes that target's adapter on-platform:
 * `bun-runner/` (real Bun, task group 3), `deno-runner/` (real Deno),
 * `workerd-runner/` (real Cloudflare/workerd). `serverless`'s real
 * deployment runtime IS Node (Lambda/GCF/Azure), which `node`'s own
 * real-runtime coverage already backs — see the package README's
 * "Real-runtime note" — so it is intentionally NOT double-counted as a
 * second `real-runtime` row.
 */
export type ProofLevel = 'real-runtime' | 'simulated';

/**
 * Real-runtime coverage BREADTH, distinct from the binary {@link ProofLevel}
 * (F-01, ADR-0010).
 *
 * @remarks
 * `full-suite` means the real-runtime runner executes the SAME shared
 * `defineConformanceSuite` the in-process driver runs (Bun and Deno: both run
 * their real binary IN-PROCESS with the test, so the suite's per-case
 * `configure` closures work normally — a behavior added to the suite
 * automatically runs there too). `curated-subset` means the real-runtime
 * runner can only execute a hand-picked set of assertions expressible as a
 * static, pre-bundled worker script — workerd (via miniflare) is a genuinely
 * SEPARATE isolate reached only over HTTP, so the shared suite's closures
 * (built fresh per test case in the Node test process) cannot cross that
 * isolate boundary. Widening workerd to `full-suite` would require
 * redefining `ConformanceDriver.dispatch` as data instead of a closure — a
 * breaking change to the driver contract used by every built-in and external
 * adapter, and its own RFC-gated decision, not something assumed here.
 */
export type RealRuntimeCoverage = 'full-suite' | 'curated-subset' | 'n/a';

/** Coverage breadth for each real-runtime runner (task-group 3 / F-01 follow-up). */
const REAL_RUNTIME_COVERAGE: Record<string, RealRuntimeCoverage> = {
  node: 'full-suite', // the native node-driver IS the real runtime, running the full suite
  bun: 'full-suite', // bun-runner/ runs Bun in-process with the test — full defineConformanceSuite
  deno: 'full-suite', // deno-runner/ runs Deno in-process with the test — full defineConformanceSuite
  edge: 'curated-subset', // workerd-runner/: a genuinely separate isolate — closures can't cross the HTTP boundary
  serverless: 'n/a', // simulated only; real target is Node, covered by node's row
};

/** Static fact about the harness's structure — not derived from driver data. */
const REAL_RUNTIME_RUNNER_EXISTS: Record<string, boolean> = {
  node: true, // native node-driver IS the real runtime (no separate runner needed)
  bun: true, // bun-runner/ (task group 3, R2)
  deno: true, // deno-runner/
  edge: true, // workerd-runner/ (real miniflare/workerd isolate)
  serverless: false, // real target is Node, already covered by `node`'s row
};

/** The capability inputs the matrix is computed from (one per conformance target). */
export interface CertInput {
  readonly name: string;
  readonly capabilities: ReturnType<typeof capabilitiesFor>;
  readonly handlerTimeout504: boolean;
  readonly teardownOnShutdown: boolean;
  readonly transportAbortFiresSignal: boolean;
  readonly proofLevel: ProofLevel;
  readonly realRuntimeCoverage: RealRuntimeCoverage;
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
  const raw = rawFeatureSupport(feature, input, c);
  // F-02: a feature with no executed conformance assertion behind it is capped
  // at `capability-only` — a capability bit is not a conformance proof. `na`
  // passes through unchanged (it is a scope decision, not a support claim).
  if (raw === 'na') return 'na';
  if (!TESTED_FEATURES.has(feature) && (raw === 'full' || raw === 'partial')) {
    return 'capability-only';
  }
  return raw;
}

/** The capability-derived support level, before the F-02 tested-feature cap is applied. */
function rawFeatureSupport(
  feature: Feature,
  input: CertInput,
  c: CertInput['capabilities']
): Support {
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

const WEIGHT: Record<Support, number> = { full: 1, partial: 0.5, 'capability-only': 0, none: 0, na: 0 };

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
    proofLevel: REAL_RUNTIME_RUNNER_EXISTS[d.name] === true ? 'real-runtime' : 'simulated',
    realRuntimeCoverage: REAL_RUNTIME_COVERAGE[d.name] ?? 'n/a',
  }));
}

const CELL: Record<Support, string> = {
  full: '✅',
  partial: '⚠️',
  'capability-only': '🔷',
  na: '➖',
  none: '❌',
};
const PROOF_LABEL: Record<ProofLevel, string> = {
  'real-runtime': '🟢 real-runtime',
  simulated: '🟡 simulated',
};

/** Coverage-breadth label per {@link RealRuntimeCoverage} (F-01, ADR-0010). */
const COVERAGE_BREADTH_LABEL: Record<RealRuntimeCoverage, string> = {
  'full-suite': '🟢 full-suite',
  'curated-subset': '🟠 curated-subset',
  'n/a': '➖ n/a',
};

/** Render the certification matrix as user-facing Markdown (task 9.3; proof-level added task group 6, R5). */
export function renderCertificationMarkdown(): string {
  const inputs = certInputs();
  const header = `| Feature | ${inputs.map((i) => i.name).join(' | ')} |`;
  const sep = `| --- | ${inputs.map(() => '---').join(' | ')} |`;
  // Proof is the FIRST body row (after the separator). A row placed between
  // the header and the `---` separator is invalid GFM and renders broken on
  // GitHub/GitLab — caught by rendering the actual output and inspecting
  // it, not assumed correct from string concatenation alone.
  const proofRow = `| **Proof** | ${inputs.map((i) => `**${PROOF_LABEL[i.proofLevel]}**`).join(' | ')} |`;
  const coverageBreadthRow = `| **Real-runtime breadth** | ${inputs.map((i) => `**${COVERAGE_BREADTH_LABEL[i.realRuntimeCoverage]}**`).join(' | ')} |`;
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
    '> **Proof level.** The `Proof` row states whether that column\'s result comes',
    '> from execution on the REAL runtime (a separate real-runtime runner:',
    '> `bun-runner/`, `deno-runner/`, `workerd-runner/`, or the native Node driver)',
    '> or from the in-process driver SIMULATION (`drivers/web-driver.ts`, which',
    '> always runs under Node/vitest regardless of which target it simulates).',
    '> Only 🟢 `real-runtime` rows back a "proven" claim in public docs — see',
    '> `docs/audits/08-runtime-compatibility-gap-analysis.md`.',
    '',
    '> **Real-runtime breadth (F-01, ADR-0010).** Even among `real-runtime` columns,',
    '> HOW MUCH of the shared behavioral contract each real runner actually proves',
    '> differs: `full-suite` means it runs the identical `defineConformanceSuite`',
    '> the in-process driver runs (Bun/Deno run their real binary IN-PROCESS with',
    '> the test, so the suite\'s per-case closures work normally — a behavior added',
    '> to the suite automatically runs there too). `curated-subset` means only a',
    '> hand-picked assertion set could be proven — workerd is a genuinely SEPARATE',
    '> isolate reached only over HTTP via miniflare, so the suite\'s closures cannot',
    '> cross that boundary; widening it needs a data-driven driver contract, an',
    '> RFC-gated decision this change does not make unilaterally.',
    '',
    'Legend: ✅ full (executed assertion) · ⚠️ partial (different model) · 🔷 capability-only (no executed assertion, F-02) · ➖ not applicable by design · ❌ unsupported',
    '',
    header,
    sep,
    proofRow,
    coverageBreadthRow,
    ...rows,
    coverage,
    '',
    '## Notes',
    '',
    '- **Timeouts** — ✅ full on every runtime (F-04/ADR-0010): Node now races the',
    '  handler against `timeout` and returns a clean 504, cancelling via `ctx.signal`,',
    '  the same contract Bun/Deno/Edge/serverless already used. `server.timeout`',
    '  remains an independent socket-level slow-client guard on Node, unaffected.',
    '- **Multipart / Compression / WebSockets** — 🔷 capability-only (F-02): support',
    '  is inferred from a `capabilitiesFor()` bit, not an executed cross-adapter',
    "  conformance assertion — the adapters implement no multipart parser, no",
    '  response-compression, and no WebSocket-upgrade path today. Not counted as',
    '  `full`/proven; add a real conformance assertion to graduate a feature out of',
    '  this state (as Streaming/SSE did — see `#20` in `suite.ts`).',
    '- **AbortSignal** — ⚠️ for `serverless`: the platform delivers a buffered event,',
    '  so there is no mid-request transport abort; `ctx.signal` still fires on timeout.',
    '- **Shutdown** — ➖ for `edge`/`serverless`: no server lifetime, so extension',
    "  `destroy()` never runs (F-14). Excluded from coverage rather than scored as a failure.",
    '- **Proof (`serverless`)** — 🟡 simulated here because its real deployment runtime',
    '  IS Node (Lambda/GCF/Azure all run Node); real-runtime coverage for that target',
    "  is `node`'s own row, not double-counted as a second real-runtime proof.",
    '',
  ].join('\n');
}

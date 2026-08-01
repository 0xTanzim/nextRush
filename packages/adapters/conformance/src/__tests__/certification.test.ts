/**
 * Certification-matrix tests (task group 9).
 *
 * Assert the matrix is derived from real capability/flag data (9.2), that a
 * seeded capability regression drops the affected runtime's score (9.3), and
 * that the committed user-facing doc stays in sync with the generator so CI
 * regenerates+checks it (9.4).
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FEATURES,
  certInputs,
  coverageOf,
  featureSupport,
  renderCertificationMarkdown,
  type CertInput,
} from '../certification';

const here = dirname(fileURLToPath(import.meta.url));
const docPath = join(here, '..', '..', '..', '..', '..', 'docs', 'runtime-certification-matrix.md');

function inputByName(name: string): CertInput {
  const input = certInputs().find((i) => i.name === name);
  if (input === undefined) throw new Error(`no cert input for ${name}`);
  return input;
}

describe('certification matrix', () => {
  it('9.1 tags every feature and covers all conformance targets', () => {
    expect(FEATURES.length).toBe(10);
    const names = certInputs().map((i) => i.name);
    expect(names).toEqual(['node', 'bun', 'deno', 'edge', 'serverless', 'nextjs']);
  });

  it('9.2 derives real per-runtime differences from capability/flag data', () => {
    // F-04/ADR-0010: Node now races the handler and returns a clean 504,
    // converging with the Web/serverless adapters — Timeouts is full everywhere.
    expect(featureSupport('Timeouts', inputByName('node'))).toBe('full');
    expect(featureSupport('Timeouts', inputByName('edge'))).toBe('full');
    // Edge/serverless have no server lifetime → Shutdown not applicable.
    expect(featureSupport('Shutdown', inputByName('edge'))).toBe('na');
    expect(featureSupport('Shutdown', inputByName('serverless'))).toBe('na');
    expect(featureSupport('Shutdown', inputByName('node'))).toBe('full');
    // Serverless buffered event model → transport AbortSignal is partial.
    expect(featureSupport('AbortSignal', inputByName('serverless'))).toBe('partial');
    expect(featureSupport('AbortSignal', inputByName('node'))).toBe('full');
  });

  it('9.3 a seeded capability regression drops the runtime score', () => {
    const bun = inputByName('bun');
    const base = coverageOf(bun);
    // Seed a regression: revoke Web Streams → Streaming/SSE/Multipart/Compression drop.
    const regressed: CertInput = {
      ...bun,
      capabilities: { ...bun.capabilities, webStreams: false, nodeStreams: false },
    };
    expect(coverageOf(regressed)).toBeLessThan(base);
  });

  it('9.5 (F-02) capability-only features are not counted full/proven', () => {
    // WebSockets/Multipart/Compression have no executed cross-adapter assertion
    // behind them — capped at capability-only regardless of the capability bit.
    expect(featureSupport('WebSockets', inputByName('node'))).toBe('capability-only');
    expect(featureSupport('Multipart', inputByName('node'))).toBe('capability-only');
    expect(featureSupport('Compression', inputByName('node'))).toBe('capability-only');
  });

  it('9.6 (F-02) executed-assertion features (Streaming/SSE) earn full, not capability-only', () => {
    // Streaming/SSE graduated to an executed conformance assertion (#20 in
    // suite.ts, exercising ctx.stream()/ctx.sse() across every driver).
    expect(featureSupport('Streaming', inputByName('node'))).toBe('full');
    expect(featureSupport('SSE', inputByName('node'))).toBe('full');
  });

  it('9.7 (F-02) capability-only scores 0 toward coverage, like none — never inflating the published %', () => {
    const node = inputByName('node');
    const withCapabilityOnlyFeature = coverageOf(node);
    const asIfNone: CertInput = {
      ...node,
      capabilities: { ...node.capabilities, webSocket: false },
    };
    // Revoking the WebSockets capability bit (none, not capability-only) must
    // score identically to capability-only — both contribute 0 to coverage.
    expect(coverageOf(asIfNone)).toBe(withCapabilityOnlyFeature);
  });

  it('9.4 the committed matrix doc is in sync with the generator (CI drift guard)', async () => {
    // toMatchFileSnapshot writes the doc when run with `-u` (the cert:matrix
    // script) and asserts equality otherwise — so CI regenerates and checks it.
    await expect(renderCertificationMarkdown()).toMatchFileSnapshot(docPath);
  });

  it('6.2 (R5) every input carries a proof level distinguishing real-runtime from simulated', () => {
    // node/bun/deno/edge each have a real-runtime runner (native driver,
    // bun-runner/, deno-runner/, workerd-runner/ respectively) — see the
    // REAL_RUNTIME_RUNNER_EXISTS map's own doc comment for why.
    expect(inputByName('node').proofLevel).toBe('real-runtime');
    expect(inputByName('bun').proofLevel).toBe('real-runtime');
    expect(inputByName('deno').proofLevel).toBe('real-runtime');
    expect(inputByName('edge').proofLevel).toBe('real-runtime');
    // serverless's real deployment runtime IS Node, already covered by
    // node's row — not double-counted as its own real-runtime proof.
    expect(inputByName('serverless').proofLevel).toBe('simulated');
  });

  it('6.2 (R5) the rendered matrix labels each runtime with its proof level', () => {
    const md = renderCertificationMarkdown();
    expect(md).toContain('real-runtime');
    expect(md).toContain('simulated');
  });
});

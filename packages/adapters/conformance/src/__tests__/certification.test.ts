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
    expect(names).toEqual(['node', 'bun', 'deno', 'edge', 'serverless']);
  });

  it('9.2 derives real per-runtime differences from capability/flag data', () => {
    // Node timeout is socket-level → partial; the Web adapters return 504 → full.
    expect(featureSupport('Timeouts', inputByName('node'))).toBe('partial');
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

  it('9.4 the committed matrix doc is in sync with the generator (CI drift guard)', async () => {
    // toMatchFileSnapshot writes the doc when run with `-u` (the cert:matrix
    // script) and asserts equality otherwise — so CI regenerates and checks it.
    await expect(renderCertificationMarkdown()).toMatchFileSnapshot(docPath);
  });
});

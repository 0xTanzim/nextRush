import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `node:http2` must stay a dynamic import.
 *
 * Importing the `nextrush` meta package pulls in this adapter, and `nextrush` is
 * the entry point of most applications — including the plain-HTTP ones that
 * never construct a TLS server. Loading `node:http2` at module scope charged its
 * native initialisation to every one of those cold starts: measured on Bun 1.4.4,
 * importing `nextrush` fell from 31.3 ms to 19.9 ms median once the import moved
 * into the TLS branch. Nothing at runtime can catch that regression, so this
 * pins the shape of the module instead.
 */
describe('lazy node:http2 import', () => {
  const source = readFileSync(new URL('../tls-server.ts', import.meta.url), 'utf8');

  it('does not import node:http2 as a value at module scope', () => {
    const staticValueImport = /^\s*import\s+(?!type\b)[^;]*from\s*['"]node:http2['"]/m;
    expect(source).not.toMatch(staticValueImport);
  });

  it('loads node:http2 only inside createNodeServer', () => {
    expect(source).toMatch(/await import\(['"]node:http2['"]\)/);
  });
});

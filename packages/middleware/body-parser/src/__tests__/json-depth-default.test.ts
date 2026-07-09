/**
 * @nextrush/body-parser - JSON default depth guard (BP-6)
 *
 * JSON parsing must reject pathologically deep nesting by default so a small
 * payload of `[[[...]]]` cannot be used as a cheap DoS.
 */

import { describe, expect, it, vi } from 'vitest';
import { json } from '../parsers/json.js';
import { DEFAULT_JSON_MAX_DEPTH } from '../constants.js';
import type { BodyParserContext } from '../types.js';

function ctxWith(body: string): BodyParserContext {
  const bytes = new TextEncoder().encode(body);
  return {
    method: 'POST',
    path: '/',
    headers: { 'content-type': 'application/json', 'content-length': String(bytes.byteLength) },
    bodySource: {
      text: async () => body,
      buffer: async () => bytes,
      json: async () => JSON.parse(body),
      get consumed() {
        return false;
      },
      get contentLength() {
        return bytes.byteLength;
      },
      get contentType() {
        return 'application/json';
      },
    },
  };
}

describe('JSON default depth guard (BP-6)', () => {
  it('rejects nesting deeper than the default limit', async () => {
    const depth = DEFAULT_JSON_MAX_DEPTH + 5;
    const body = '['.repeat(depth) + ']'.repeat(depth);
    const next = vi.fn().mockResolvedValue(undefined);
    await expect(json()(ctxWith(body), next)).rejects.toMatchObject({
      code: 'JSON_DEPTH_EXCEEDED',
    });
  });

  it('accepts ordinary shallow JSON by default', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = ctxWith('{"a":{"b":{"c":1}}}');
    await expect(json()(ctx, next)).resolves.toBeUndefined();
    expect(ctx.body).toEqual({ a: { b: { c: 1 } } });
  });

  it('lets an explicit maxDepth override the default', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const body = '{"a":{"b":{"c":1}}}'; // depth 3
    await expect(json({ maxDepth: 2 })(ctxWith(body), next)).rejects.toMatchObject({
      code: 'JSON_DEPTH_EXCEEDED',
    });
  });
});

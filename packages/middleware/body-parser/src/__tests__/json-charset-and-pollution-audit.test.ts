/**
 * @nextrush/body-parser - JSON charset handling and prototype-pollution
 * surface (`audit-unreviewed-security-surface`, area 3).
 *
 * `json.ts` always decodes as UTF-8 regardless of a declared `charset=`
 * parameter — verified below as spec-correct (RFC 8259 §8.1 mandates UTF-8
 * for JSON exchanged between systems), not a charset-confusion vulnerability
 * (there is only one decode step; a mismatched declared charset is never
 * acted on for a second, conflicting decode elsewhere).
 *
 * `JSON.parse`'s own `__proto__`-key handling is verified directly against
 * the real parser (not assumed) — a `"__proto__"` key inside a JSON object
 * literal becomes an OWN enumerable property, never a prototype-chain
 * assignment, because `JSON.parse` builds objects via internal object
 * creation, not `obj.__proto__ = x` / `obj[key] = x` assignment. This
 * differs fundamentally from `urlencoded()`'s vector (already guarded, see
 * `body-parser.test.ts`'s "Security: Prototype Pollution Prevention" block)
 * because that parser builds nested objects via manual bracket-path
 * assignment, which DOES walk the prototype chain if unguarded.
 */
import { describe, expect, it, vi } from 'vitest';
import { json } from '../parsers/json';
import type { BodyParserContext } from '../types';

function createBodySource(body: string): BodyParserContext['bodySource'] {
  const buf = new TextEncoder().encode(body);
  let consumed = false;
  return {
    async text() {
      consumed = true;
      return body;
    },
    async buffer() {
      consumed = true;
      return buf;
    },
    async json<T>() {
      consumed = true;
      return JSON.parse(body) as T;
    },
    get consumed() {
      return consumed;
    },
    get contentLength() {
      return undefined;
    },
    get contentType() {
      return undefined;
    },
  };
}

function createMockContext(contentType: string, body: string): BodyParserContext {
  return {
    method: 'POST',
    path: '/',
    headers: {
      'content-type': contentType,
      'content-length': String(Buffer.byteLength(body)),
    },
    bodySource: createBodySource(body),
  };
}

describe('JSON body parser — charset handling', () => {
  it('a UTF-8 body is parsed correctly regardless of a mismatched declared charset', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    // The body IS valid UTF-8 JSON; the header falsely declares iso-8859-1.
    // RFC 8259 mandates JSON exchanged between systems be UTF-8 — a
    // compliant parser decodes as UTF-8 regardless of this declaration.
    const ctx = createMockContext(
      'application/json; charset=iso-8859-1',
      JSON.stringify({ name: 'café' })
    );

    await json()(ctx, next);

    expect(ctx.body).toEqual({ name: 'café' });
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('JSON body parser — prototype pollution', () => {
  it('a `__proto__` key in the JSON body becomes an own property, never a prototype-chain write', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext('application/json', '{"__proto__":{"polluted":true}}');

    await json()(ctx, next);

    const body = ctx.body as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(body, '__proto__')).toBe(true);
    // If this were a real pollution, a FRESH object literal would now carry
    // `polluted` too — not just the parsed body.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('a nested `constructor.prototype` path in the JSON body does not pollute Object.prototype', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext(
      'application/json',
      '{"a":{"constructor":{"prototype":{"polluted":true}}}}'
    );

    await json()(ctx, next);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

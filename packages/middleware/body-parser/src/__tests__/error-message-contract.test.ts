/**
 * @nextrush/body-parser - the response-visible failure message is a constant
 *
 * The parsers embedded the JS engine's own parse text in the message
 * (`"Invalid JSON: Expected property name or '}' in JSON at position 1"`),
 * which leaked internals and produced a different body per runtime for the same
 * request. The engine text is still worth keeping — server-side, in a `cause`
 * that is never serialized.
 */

import { describe, expect, it, vi } from 'vitest';
import { BodyParserError, Errors, json, type BodyParserContext } from '../index';

function createBodySource(body?: string): BodyParserContext['bodySource'] {
  return {
    async text() {
      return body ?? '';
    },
    async buffer() {
      return new TextEncoder().encode(body ?? '');
    },
    async json<T>() {
      return JSON.parse(body ?? 'null') as T;
    },
    get consumed() {
      return false;
    },
    get contentLength() {
      return undefined;
    },
    get contentType() {
      return undefined;
    },
  };
}

function createMockContext(body: string): BodyParserContext {
  return {
    method: 'POST',
    path: '/',
    headers: {
      'content-type': 'application/json',
      'content-length': String(body.length),
    },
    bodySource: createBodySource(body),
  };
}

const ENGINE_TEXT = /position \d|Parse error|Unexpected token|Expected |JSON Parse error/;

describe('a parser failure exposes a framework constant, never the engine text', () => {
  it('reports a malformed JSON body as exactly "Invalid JSON"', async () => {
    const next = vi.fn().mockResolvedValue(undefined);

    const error = await json()(createMockContext('{bad'), next).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BodyParserError);
    expect((error as BodyParserError).message).toBe('Invalid JSON');
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps the engine text in a non-enumerable cause', async () => {
    const error = (await json()(createMockContext('{bad'), vi.fn()).catch(
      (err: unknown) => err
    )) as BodyParserError;

    const cause = (error as Error).cause;
    expect(typeof cause).toBe('string');
    expect(String(cause).length).toBeGreaterThan(0);
    expect(Object.getOwnPropertyDescriptor(error, 'cause')?.enumerable).toBe(false);
  });

  it('never serializes the cause into the error body', async () => {
    const error = (await json()(createMockContext('{bad'), vi.fn()).catch(
      (err: unknown) => err
    )) as BodyParserError;

    const serialized = JSON.stringify(error.toJSON());
    expect(serialized).not.toMatch(ENGINE_TEXT);
    expect(serialized).toContain('"message":"Invalid JSON"');
  });

  it('builds invalidJson and invalidUrlEncoded from constants with a cause', () => {
    const jsonError = Errors.invalidJson("Expected '}'");
    expect(jsonError.message).toBe('Invalid JSON');
    expect(jsonError.cause).toBe("Expected '}'");
    expect(jsonError.code).toBe('INVALID_JSON');

    const urlError = Errors.invalidUrlEncoded('URI malformed');
    expect(urlError.message).toBe('Invalid URL-encoded body');
    expect(urlError.cause).toBe('URI malformed');
    expect(urlError.code).toBe('INVALID_URLENCODED');
  });

  it('leaves our own diagnostics (size, depth) intact', () => {
    expect(Errors.entityTooLarge(200, 100).message).toContain('Request body too large');
    expect(Errors.jsonDepthExceeded(65, 64).message).toContain('65 exceeds 64');
  });
});

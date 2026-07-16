/**
 * @nextrush/adapter-edge - Body Source Tests
 */

import { BodyConsumedError, BodyTooLargeError, EmptyBodySource as RuntimeEmptyBodySource } from '@nextrush/runtime';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyBodySource, EmptyBodySource } from '../body-source';

describe('EmptyBodySource', () => {
  let emptySource: EmptyBodySource;

  beforeEach(() => {
    emptySource = new EmptyBodySource();
  });

  it('should have contentLength of 0', () => {
    expect(emptySource.contentLength).toBe(0);
  });

  it('should have undefined contentType', () => {
    expect(emptySource.contentType).toBeUndefined();
  });

  it('should not be consumed', () => {
    expect(emptySource.consumed).toBe(false);
  });

  it('should return empty string from text()', async () => {
    const text = await emptySource.text();
    expect(text).toBe('');
  });

  it('should return empty Uint8Array from buffer()', async () => {
    const buffer = await emptySource.buffer();
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBe(0);
  });

  it('should throw BadRequestError from json()', async () => {
    await expect(emptySource.json()).rejects.toThrow('Request body is empty');
  });

  it('should return empty ReadableStream from stream()', async () => {
    const stream = emptySource.stream();
    expect(stream).toBeInstanceOf(ReadableStream);

    const reader = stream.getReader();
    const { done, value } = await reader.read();
    expect(done).toBe(true);
    expect(value).toBeUndefined();
  });
});

describe('BodyConsumedError', () => {
  it('should have correct message', () => {
    const error = new BodyConsumedError();
    expect(error.message).toBe('Body has already been consumed');
    expect(error.name).toBe('BodyConsumedError');
  });
});

describe('BodyTooLargeError', () => {
  it('should have correct message and properties', () => {
    const error = new BodyTooLargeError(100, 200);

    expect(error.message).toContain('200 bytes');
    expect(error.message).toContain('100 bytes');
    expect(error.name).toBe('BodyTooLargeError');
    expect(error.limit).toBe(100);
    expect(error.received).toBe(200);
  });
});

describe('createEmptyBodySource', () => {
  it('should create EmptyBodySource instance', () => {
    const bodySource = createEmptyBodySource();
    expect(bodySource).toBeInstanceOf(EmptyBodySource);
  });
});

describe('F-04a — shared WebBodySource reuse', () => {
  it('EmptyBodySource is the shared runtime EmptyBodySource', () => {
    expect(EmptyBodySource).toBe(RuntimeEmptyBodySource);
  });
});

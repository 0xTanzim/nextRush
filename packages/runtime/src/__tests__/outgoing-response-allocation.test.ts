/**
 * @nextrush/runtime - the record's header-map allocation guarantee
 *
 * The common response is a body method's content type and nothing else. That
 * path must not allocate a header map: on a per-request hot path it would be a
 * new allocation for every response that carries only its default
 * `Content-Type`.
 *
 * The check observes the map's constructor directly rather than sampling the
 * heap, so it is deterministic: `HeaderList` is replaced with a counting
 * subclass for this file only, and every behaviour it inherits is the real one.
 */

import { describe, expect, it, vi } from 'vitest';

const constructions = vi.hoisted(() => ({ count: 0 }));

vi.mock('../outgoing-headers.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../outgoing-headers.js')>();

  class CountingHeaderList extends actual.HeaderList {
    constructor() {
      super();
      constructions.count += 1;
    }
  }

  return { ...actual, HeaderList: CountingHeaderList };
});

const { OutgoingResponse } = await import('../outgoing-response.js');

describe('OutgoingResponse header-map allocation', () => {
  it('allocates no header map for a response with only the default Content-Type', () => {
    constructions.count = 0;

    const record = new OutgoingResponse();
    record.setBody('{"ok":true}', 'application/json; charset=utf-8');

    expect(record.contentType).toBe('application/json; charset=utf-8');
    expect(record.extraHeaders()).toEqual([]);
    expect(constructions.count).toBe(0);

    record.set('X-Trace-Id', 'abc');

    expect(constructions.count).toBe(1);
    expect(record.extraHeaders()).toEqual([['X-Trace-Id', 'abc']]);
  });
});

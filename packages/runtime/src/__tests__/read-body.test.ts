/**
 * @nextrush/runtime — `WebContextBase.readBody()` (RFC-047) unit tests.
 *
 * @remarks
 * `readBody()` is the portable body API: it must resolve from the eagerly parsed
 * body when no parser installed a reader, delegate when one did, and allocate
 * nothing itself — an eager request must not pay for a lazy-mode feature it
 * never opted into.
 */

import { describe, expect, it, vi } from 'vitest';
import { BODY_READER, type BodyReaderCarrier, type DeferredBodyReader } from '@nextrush/types';
import { WebContextBase } from '../web-context-base';
import type { WebStreamRunners } from '../web-context-base';

/** Minimal concrete subclass — a real subclass, not a mock of the base itself. */
class TestContext extends WebContextBase {
  constructor(request: Request) {
    super(request, '', 'bun', {
      runTextStream: async () => undefined,
      runSSEStream: async () => undefined,
      runNDJSONStream: async () => undefined,
    } satisfies WebStreamRunners);
  }
}

function makeContext(init?: RequestInit): TestContext {
  return new TestContext(new Request('http://localhost/path', init));
}

/** Read the installed reader, if any, without tripping an absent-slot error. */
function readerOf(ctx: TestContext): DeferredBodyReader | undefined {
  return (ctx as BodyReaderCarrier)[BODY_READER];
}

/** Install a reader the way a lazy body parser does — on this context only. */
function installReader(ctx: TestContext, reader: DeferredBodyReader): void {
  Object.defineProperty(ctx, BODY_READER, { value: reader, configurable: true });
}

describe('WebContextBase.readBody — no reader installed (eager parsing)', () => {
  it('resolves the body the middleware already parsed', async () => {
    const ctx = makeContext({ method: 'POST', body: 'ignored' });
    ctx.body = { id: 7 };

    await expect(ctx.readBody<{ id: number }>()).resolves.toEqual({ id: 7 });
  });

  it('resolves undefined for a request no parser claimed', async () => {
    const ctx = makeContext({ method: 'GET' });

    await expect(ctx.readBody()).resolves.toBeUndefined();
  });

  it('does not read the body source', async () => {
    const ctx = makeContext({ method: 'POST', body: 'payload' });
    ctx.body = { parsed: true };
    const text = vi.spyOn(ctx.bodySource, 'text');
    const buffer = vi.spyOn(ctx.bodySource, 'buffer');
    const json = vi.spyOn(ctx.bodySource, 'json');

    await ctx.readBody();

    expect(text).not.toHaveBeenCalled();
    expect(buffer).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it('installs nothing: no reader slot, no property-shape change', async () => {
    const ctx = makeContext({ method: 'POST', body: 'payload' });
    ctx.body = { parsed: true };
    const bodySource = ctx.bodySource;
    const before = Object.getOwnPropertyNames(ctx);
    const bodyDescriptorBefore = Object.getOwnPropertyDescriptor(ctx, 'body');

    await ctx.readBody();

    expect(readerOf(ctx)).toBeUndefined();
    expect(ctx.bodySource).toBe(bodySource);
    expect(Object.getOwnPropertyNames(ctx)).toEqual(before);
    expect(Object.getOwnPropertyDescriptor(ctx, 'body')).toEqual(bodyDescriptorBefore);
    // Still a plain data property — not the throwing accessor lazy mode installs.
    expect(Object.getOwnPropertyDescriptor(ctx, 'body')?.value).toEqual({ parsed: true });
  });
});

describe('WebContextBase.readBody — reader installed (lazy parsing)', () => {
  it('delegates to the installed reader and resolves its value', async () => {
    const ctx = makeContext({ method: 'POST' });
    const read = vi.fn(async () => ({ parsed: 'lazily' }));
    installReader(ctx, { read });

    await expect(ctx.readBody<{ parsed: string }>()).resolves.toEqual({ parsed: 'lazily' });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('propagates the reader’s rejection without touching ctx.body', async () => {
    const ctx = makeContext({ method: 'POST' });
    const failure = new Error('invalid json');
    installReader(ctx, {
      read: async () => {
        throw failure;
      },
    });

    await expect(ctx.readBody()).rejects.toBe(failure);
    expect(ctx.body).toBeUndefined();
  });
});

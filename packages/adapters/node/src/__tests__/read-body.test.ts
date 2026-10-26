/**
 * @nextrush/adapter-node — `NodeContext.readBody()` (RFC-047) unit tests.
 *
 * @remarks
 * `readBody()` must resolve from the eagerly parsed body (the default) without
 * materializing the lazily built `NodeBodySource`, delegate when a lazy parser
 * installed a reader, and change nothing about the context when no reader exists.
 */

import { describe, expect, it, vi } from 'vitest';
import { BODY_READER, type BodyReaderCarrier, type DeferredBodyReader } from '@nextrush/types';
import { NodeContext } from '../context';
import { NodeBodySource } from '../body-source';
import { createMockRequest, createMockResponse } from './_shared/mock-response';

function makeContext(method = 'POST'): NodeContext {
  return new NodeContext(createMockRequest({ method }), createMockResponse().res);
}

function readerOf(ctx: NodeContext): DeferredBodyReader | undefined {
  return (ctx as BodyReaderCarrier)[BODY_READER];
}

function installReader(ctx: NodeContext, reader: DeferredBodyReader): void {
  Object.defineProperty(ctx, BODY_READER, { value: reader, configurable: true });
}

/** The private lazy backing field; reading the public getter would allocate. */
function backingSource(ctx: NodeContext): unknown {
  return (ctx as unknown as { _bodySource?: unknown })._bodySource;
}

describe('NodeContext.readBody — no reader installed (eager parsing)', () => {
  it('resolves the body the middleware already parsed', async () => {
    const ctx = makeContext();
    ctx.body = { parsed: 'eagerly' };

    await expect(ctx.readBody<{ parsed: string }>()).resolves.toEqual({ parsed: 'eagerly' });
  });

  it('does not allocate a NodeBodySource on a body-method request', async () => {
    const ctx = makeContext('POST');
    ctx.body = { parsed: true };

    await ctx.readBody();

    expect(backingSource(ctx)).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(ctx, 'bodySource')).toBe(false);
  });

  it('installs nothing: no reader slot, no property-shape change', async () => {
    const ctx = makeContext('POST');
    ctx.body = { parsed: true };
    const before = Object.getOwnPropertyNames(ctx);
    const bodyDescriptorBefore = Object.getOwnPropertyDescriptor(ctx, 'body');

    await ctx.readBody();

    expect(readerOf(ctx)).toBeUndefined();
    expect(Object.getOwnPropertyNames(ctx)).toEqual(before);
    expect(Object.getOwnPropertyDescriptor(ctx, 'body')).toEqual(bodyDescriptorBefore);
    expect(Object.getOwnPropertyDescriptor(ctx, 'body')?.value).toEqual({ parsed: true });
  });

  it('control: reading bodySource does build a NodeBodySource', () => {
    const ctx = makeContext('POST');

    expect(ctx.bodySource).toBeInstanceOf(NodeBodySource);
    expect(backingSource(ctx)).toBeInstanceOf(NodeBodySource);
  });
});

describe('NodeContext.readBody — reader installed (lazy parsing)', () => {
  it('delegates to the installed reader and resolves its value', async () => {
    const ctx = makeContext();
    const read = vi.fn(async () => ({ parsed: 'lazily' }));
    installReader(ctx, { read });

    await expect(ctx.readBody<{ parsed: string }>()).resolves.toEqual({ parsed: 'lazily' });
    expect(read).toHaveBeenCalledTimes(1);
    expect(backingSource(ctx)).toBeUndefined();
  });

  it('propagates the reader’s rejection without touching ctx.body', async () => {
    const ctx = makeContext();
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

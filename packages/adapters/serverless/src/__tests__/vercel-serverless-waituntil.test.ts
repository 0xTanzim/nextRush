import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '@nextrush/core';
import { createVercelHandler } from '../vercel';
import type { VercelIncomingMessageLike, VercelServerResponseLike } from '../platform-shapes';

describe('Vercel Serverless (Node.js) waitUntil support (Issue #76)', () => {
  const vercelSymbol = Symbol.for('@vercel/request-context');

  afterEach(() => {
    delete (globalThis as unknown as Record<symbol, unknown>)[vercelSymbol];
    vi.restoreAllMocks();
  });

  function createMockNodeReqRes(url = '/test'): {
    req: VercelIncomingMessageLike;
    res: VercelServerResponseLike;
    chunks: string[];
  } {
    const chunks: string[] = [];
    const headers: Record<string, string | string[]> = {};

    const req: VercelIncomingMessageLike = {
      method: 'GET',
      url,
      headers: { host: 'localhost' },
    };

    const res: VercelServerResponseLike = {
      statusCode: 200,
      headersSent: false,
      writableEnded: false,
      setHeader(name: string, value: string | string[]) {
        headers[name.toLowerCase()] = value;
      },
      getHeader(name: string) {
        return headers[name.toLowerCase()];
      },
      write(chunk: unknown) {
        chunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk as Uint8Array));
        return true;
      },
      end() {
        this.writableEnded = true;
      },
    };

    return { req, res, chunks };
  }

  it('forwards background tasks to Symbol.for("@vercel/request-context") during Node (req, res) invocations', async () => {
    const globalWaitUntil = vi.fn();
    (globalThis as unknown as Record<symbol, unknown>)[vercelSymbol] = {
      get: () => ({ waitUntil: globalWaitUntil }),
    };

    const app = createApp();
    app.use(async (ctx) => {
      ctx.waitUntil(Promise.resolve('vercel-node-telemetry'));
      ctx.json({ ok: true });
    });

    const handler = createVercelHandler(app);
    const { req, res } = createMockNodeReqRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(globalWaitUntil).toHaveBeenCalledTimes(1);
  });

  it('settles background tasks before completing when no native host context is present', async () => {
    let taskCompleted = false;
    const backgroundTask = new Promise<void>((resolve) => {
      setTimeout(() => {
        taskCompleted = true;
        resolve();
      }, 25);
    });

    const app = createApp();
    app.use(async (ctx) => {
      ctx.waitUntil(backgroundTask);
      ctx.json({ ok: true });
    });

    const handler = createVercelHandler(app);
    const { req, res } = createMockNodeReqRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    // When no Vercel global context exists, createVercelHandler safely settled the task
    expect(taskCompleted).toBe(true);
  });
});

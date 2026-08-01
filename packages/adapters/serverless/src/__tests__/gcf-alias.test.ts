/**
 * @nextrush/adapter-serverless - createGcfHandler alias (P4-1).
 */

import { createApp } from '@nextrush/core';
import { describe, expect, it } from 'vitest';
import { createGcfHandler, createGoogleHandler } from '../index';

describe('createGcfHandler (P4-1 platform-named alias)', () => {
  it('is the same function reference as createGoogleHandler', () => {
    expect(createGcfHandler).toBe(createGoogleHandler);
  });

  it('behaves identically to createGoogleHandler as a drop-in', async () => {
    const app = createApp();
    app.use((ctx) => ctx.json({ ok: true }));
    const handler = createGcfHandler(app);

    const calls: string[] = [];
    const res = {
      status(code: number) {
        calls.push(`status:${code}`);
        return this;
      },
      setHeader() {
        return this;
      },
      send(body: string | Uint8Array) {
        calls.push(`send:${String(body)}`);
        return this;
      },
    };
    await handler({ method: 'GET', path: '/', headers: {} }, res);
    expect(calls[0]).toBe('status:200');
    expect(calls[1]).toBe('send:{"ok":true}');
  });
});

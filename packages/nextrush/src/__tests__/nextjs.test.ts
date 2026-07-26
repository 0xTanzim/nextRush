import { describe, expect, it } from 'vitest';

describe('nextrush/nextjs meta export', () => {
  it('re-exports handle from @nextrush/adapter-nextjs unchanged', async () => {
    const metaExport = await import('../nextjs');
    const directExport = await import('@nextrush/adapter-nextjs');

    expect(metaExport.handle).toBe(directExport.handle);
  });

  it('mounts a real app end to end through the meta re-export', async () => {
    const { createApp, createRouter } = await import('../index');
    const { handle } = await import('../nextjs');

    const app = createApp();
    const api = createRouter();
    api.get('/hello', (ctx) => ctx.json({ ok: true }));
    app.route('/api', api);

    const { GET } = handle(app);
    const response = await GET(new Request('http://localhost/api/hello'), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

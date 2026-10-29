import { createApp, createRouter, type Context, type RouteHandler } from 'nextrush';
import { handle } from '@nextrush/adapter-nextjs';

const app = createApp();

const api = createRouter();
api.get('/hello', (ctx) => {
  ctx.json({ message: 'Hello Next.js!' });
});

// RFC-050: a handler's return value settles the response. These handlers never
// write through `ctx`, so a drop-on-the-floor adapter answers an empty 200.
// `RouteHandler` stays `void | Promise<void>` (RFC decision), so a value-returning
// handler needs the documented cast.
api.get(
  '/returned-array',
  (() => [
    { id: 1, name: 'Atlas' },
    { id: 2, name: 'Orion' },
  ]) as unknown as RouteHandler
);

api.get(
  '/returned-response',
  (() => Response.json({ id: 1 }, { status: 201, headers: { 'x-made': 'yes' } })) as unknown as RouteHandler
);

// Committed-response precedence: the value written through `ctx` wins over the
// handler's return, whatever the return holds.
api.get(
  '/committed',
  ((ctx: Context) => {
    ctx.status = 202;
    ctx.json({ committed: true });
    return { ignored: true };
  }) as unknown as RouteHandler
);

app.route('/api', api);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const HEAD = handle(app);
export const OPTIONS = handle(app);

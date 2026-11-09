import { createApp, createRouter } from 'nextrush';
import { handle } from '@nextrush/adapter-nextjs';

const app = createApp();

const api = createRouter();
api.get('/hello', (ctx) => {
  ctx.json({ message: 'Hello Next.js!' });
});
app.route('/api', api);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const HEAD = handle(app);
export const OPTIONS = handle(app);

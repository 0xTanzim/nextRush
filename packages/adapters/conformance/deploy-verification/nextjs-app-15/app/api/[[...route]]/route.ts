import { createApp, createRouter } from 'nextrush';
import { handle } from '@nextrush/adapter-nextjs';

const app = createApp();

const api = createRouter();
api.get('/hello', (ctx) => {
  ctx.json({ message: 'Hello Next.js!' });
});
app.route('/api', api);

export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(app);

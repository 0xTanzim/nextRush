import { createApp, createRouter } from 'nextrush';
import { handle } from '@nextrush/adapter-nextjs';

// Next 14: default GET caching is static, not dynamic (flipped in 15.0.0-RC —
// RFC-024 §3.2.4/§8.5). Required here so this fixture's GET reflects the
// request rather than a build-time-frozen response.
export const dynamic = 'force-dynamic';

const app = createApp();

const api = createRouter();
api.get('/hello', (ctx) => {
  ctx.json({ message: 'Hello Next.js!' });
});
app.route('/api', api);

export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(app);

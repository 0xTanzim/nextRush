import { createApp, createRouter } from 'nextrush';
import { handle } from '@nextrush/adapter-nextjs';

// Guards the destructuring form alongside the direct-assignment route at
// app/api/[[...route]]/route.ts — both must compile under the same Next build.
const app = createApp();

const api = createRouter();
api.get('/hello', (ctx) => {
  ctx.json({ style: 'destructured' });
});
app.route('/destructured', api);

export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(app);

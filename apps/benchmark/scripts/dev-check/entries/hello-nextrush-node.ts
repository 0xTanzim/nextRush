import { createApp, listen } from 'nextrush';
const app = createApp();
app.get('/', (ctx) => ctx.json({ hello: 'world' }));
listen(app, 3000);

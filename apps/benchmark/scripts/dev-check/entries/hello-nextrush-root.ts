// What a user writes with the default entry (no adapter used -> measures tree-shaking).
import { createApp } from 'nextrush';
const app = createApp();
app.get('/', (ctx) => ctx.json({ hello: 'world' }));
console.log(typeof app);

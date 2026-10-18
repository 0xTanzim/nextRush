import { Hono } from 'hono';
const app = new Hono();
app.get('/', (c) => c.json({ hello: 'world' }));
console.log(typeof app.fetch);

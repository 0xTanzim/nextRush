// Real-listener entry for the Elysia reference arm. Bun-only.
import { Elysia } from 'elysia';
const app = new Elysia().get('/', () => ({ hello: 'world' }));
app.listen({ port: Number(process.env.PORT) });
console.log('listening');

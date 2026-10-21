// Wire-benchmark server for a parsed 1 KB JSON POST on Elysia. Env: PORT. Bun-only.
// Destructuring `body` keeps the parse on the measured path instead of letting a
// handler that never reads it skip the work.
import { Elysia } from 'elysia';
const app = new Elysia().post('/', ({ body }) => ({ ok: Boolean(body) }));
app.listen({ port: Number(process.env.PORT) });

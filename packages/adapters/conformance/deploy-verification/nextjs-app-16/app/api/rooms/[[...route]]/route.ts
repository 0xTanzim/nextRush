/**
 * Conference-room CRUD surface for the Next.js real-server proof.
 *
 * One catch-all module on purpose: Next compiles each route file as its own
 * bundle, so splitting `/rooms` and `/rooms/:id` into two modules would give
 * each its own copy of the in-memory store. Keeping one module graph keeps one
 * store per server process, which the sequential-state test depends on.
 */

import { createApp, createRouter } from 'nextrush';
import { bodyParser } from '@nextrush/body-parser';
import { handle } from '@nextrush/adapter-nextjs';
import {
  createRoom,
  deleteRoom,
  findRoom,
  listRooms,
  patchRoom,
  replaceRoom,
} from '@/lib/rooms';
import { validateRoomInput, validateRoomPatch } from '@/lib/validate';

const router = createRouter();
const app = createApp({ router });

app.use(bodyParser({ onUnsupportedContentType: 'reject' }));

const api = createRouter();

api.get('/rooms', (ctx) => {
  ctx.json(listRooms());
});

api.get('/rooms/:id', (ctx) => {
  const room = findRoom(ctx.params.id);
  if (!room) {
    ctx.status = 404;
    return;
  }
  ctx.json(room);
});

api.post('/rooms', (ctx) => {
  const result = validateRoomInput(ctx.body);
  if (!result.ok) {
    ctx.json({ error: 'Invalid room input', issues: result.issues }, 400);
    return;
  }
  ctx.json(createRoom(result.value), 201);
});

api.put('/rooms/:id', (ctx) => {
  if (!findRoom(ctx.params.id)) {
    ctx.status = 404;
    return;
  }
  const result = validateRoomInput(ctx.body);
  if (!result.ok) {
    ctx.json({ error: 'Invalid room input', issues: result.issues }, 400);
    return;
  }
  const room = replaceRoom(ctx.params.id, result.value);
  if (!room) {
    ctx.status = 404;
    return;
  }
  ctx.json(room);
});

api.patch('/rooms/:id', (ctx) => {
  if (!findRoom(ctx.params.id)) {
    ctx.status = 404;
    return;
  }
  const result = validateRoomPatch(ctx.body);
  if (!result.ok) {
    ctx.json({ error: 'Invalid room patch', issues: result.issues }, 400);
    return;
  }
  const room = patchRoom(ctx.params.id, result.value);
  if (!room) {
    ctx.status = 404;
    return;
  }
  ctx.json(room);
});

api.delete('/rooms/:id', (ctx) => {
  if (!deleteRoom(ctx.params.id)) {
    ctx.status = 404;
    return;
  }
  ctx.status = 204;
});

router.mount('/api', api);
// Registered before the router mounts at ready(): it awaits the router, then
// turns an unmatched method on a known path into 405/OPTIONS with `Allow`.
app.use(router.allowedMethods());

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const HEAD = handle(app);
export const OPTIONS = handle(app);

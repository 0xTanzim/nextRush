/**
 * NextRush OpenAPI — basic example (the golden path)
 *
 * Define each route ONCE with `validate()` + `endpoint()`. NextRush collects
 * that metadata at registration and `@nextrush/openapi` renders it as an
 * OpenAPI 3.1 spec plus interactive Swagger UI — no decorators, no duplication.
 *
 *   pnpm --filter openapi-basic dev
 *   open http://localhost:3000/docs
 */
import { bodyParser } from '@nextrush/body-parser';
import { openapi } from '@nextrush/openapi';
import { validate } from '@nextrush/validation';
import {
  createApp,
  createRouter,
  endpoint,
  errorHandler,
  serve,
} from 'nextrush';
import { z } from 'zod';

// 1. Schemas — one source of truth for validation AND documentation.
//    (Zod 4's `z.toJSONSchema` populates real schemas in the spec. With Zod 3
//    the request still validates; the docs just show an empty schema.)
const CreateUser = z.object({
  name: z.string().min(1).max(80),
  email: z.string(),
  age: z.number().optional(),
});

const User = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

const app = createApp();
const router = createRouter();

app.use(errorHandler()); // validation failures → clean 400 JSON
app.use(bodyParser()); //   parse JSON request bodies

// 2. Routes. `validate(CreateUser)` documents the request body for free;
//    `endpoint()` adds the summary, tags, and response schema.
router.get(
  '/users/:id',
  endpoint({ summary: 'Get a user by id', tags: ['users'], responses: { 200: User } }),
  (ctx) => ctx.json({ id: ctx.params.id, name: 'Ada', email: 'ada@example.com' })
);

router.post(
  '/users',
  validate(CreateUser),
  endpoint({ summary: 'Create a user', tags: ['users'], responses: { 201: User } }),
  (ctx) => {
    ctx.status = 201;
    ctx.json({ id: 'u_1', ...(ctx.body as Record<string, unknown>) });
  }
);

app.route('/', router);

// 3. OpenAPI — zero-config. Serves the spec at /openapi.json and Swagger UI at /docs.
app.plugin(
  openapi({
    router,
    info: { title: 'Users API', version: '1.0.0' },
  })
);

const port = Number(process.env.PORT ?? 3000);
serve(app, { port });
console.log(`▶ Swagger UI:  http://localhost:${port}/docs`);
console.log(`▶ OpenAPI JSON: http://localhost:${port}/openapi.json`);

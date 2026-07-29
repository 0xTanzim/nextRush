/**
 * Build-time OpenAPI spec generator for the docs site (docs-v4-rebuild §2.2).
 *
 * Dogfoods `@nextrush/openapi`: it describes a small, representative API as the
 * framework's own `RouteDefinition[]` (the exact projection `router.getRoutes()`
 * produces) with `endpoint()`-style metadata + zod request/response schemas, then
 * runs the REAL `generateDocument(...)` transform — the same one every NextRush
 * app uses — and writes the result to `public/openapi.json`.
 *
 * The Scalar reference page renders that static file client-side. The docs site is
 * a static export, so this is a read-only interactive reference: "try it out" would
 * need a separately-deployed demo API (the spec carries no live `servers` URL).
 *
 * Runs in the docs `prebuild` step after workspace packages are built (turbo
 * enforces order). Imports `@nextrush/openapi`'s built `dist/` by relative path;
 * the docs app takes no runtime dependency on it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RouteDefinition, StandardSchemaV1 } from '../../../packages/types/dist/index.js';
import { generateDocument } from '../../../packages/middleware/openapi/dist/index.js';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../public/openapi.json');

// --- Schemas (zod v4 implements Standard Schema; converted via z.toJSONSchema) ---
const User = z.object({
  id: z.string().describe('Stable unique identifier'),
  name: z.string(),
  email: z.email(),
  createdAt: z.iso.datetime(),
});
const CreateUser = z.object({ name: z.string().min(1), email: z.email() });
const LoginBody = z.object({ email: z.email(), password: z.string().min(8) });
const Token = z.object({ token: z.string(), expiresIn: z.number() });
const ErrorResponse = z.object({ error: z.string(), status: z.number() });

const s = (schema: z.ZodType) => schema as unknown as StandardSchemaV1;

/** Build a RouteDefinition — the exact shape `router.getRoutes()` yields. */
function route(
  method: RouteDefinition['method'],
  routePath: string,
  metadata: RouteDefinition['metadata']
): RouteDefinition {
  return { key: `${method} ${routePath}`, method, path: routePath, metadata };
}

// --- A representative API (Users + Auth), as the framework's own route metadata ---
const routes: RouteDefinition[] = [
  route('GET', '/health', {
    summary: 'Liveness probe',
    description: 'Returns `{ status: "ok" }` when the service is up.',
    tags: ['System'],
    responses: { 200: s(z.object({ status: z.literal('ok') })) },
  }),
  route('GET', '/users', {
    summary: 'List users',
    tags: ['Users'],
    responses: { 200: s(z.array(User)) },
  }),
  route('POST', '/users', {
    summary: 'Create a user',
    tags: ['Users'],
    request: { body: s(CreateUser) },
    responses: { 201: s(User), 400: s(ErrorResponse) },
  }),
  route('GET', '/users/:id', {
    summary: 'Get a user by id',
    tags: ['Users'],
    responses: { 200: s(User), 404: s(ErrorResponse) },
  }),
  route('PUT', '/users/:id', {
    summary: 'Update a user',
    tags: ['Users'],
    request: { body: s(CreateUser) },
    responses: { 200: s(User), 404: s(ErrorResponse) },
  }),
  route('DELETE', '/users/:id', {
    summary: 'Delete a user',
    tags: ['Users'],
    responses: { 404: s(ErrorResponse) },
  }),
  route('POST', '/auth/login', {
    summary: 'Log in',
    description: 'Exchange credentials for a bearer token.',
    tags: ['Auth'],
    request: { body: s(LoginBody) },
    responses: { 200: s(Token), 401: s(ErrorResponse) },
  }),
];

async function main() {
  const doc = await generateDocument(routes, {
    info: {
      title: 'NextRush Example API',
      version: '1.0.0',
      description:
        'A representative OpenAPI 3.1 document generated at build time from real ' +
        'NextRush route metadata via `@nextrush/openapi` — the same `generateDocument()` ' +
        'your own app uses. It illustrates the interactive reference; it is not a live service.',
    },
    toJsonSchema: (schema) =>
      z.toJSONSchema(schema as unknown as z.ZodType, { target: 'openapi-3.0' }),
  });

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`);

  const pathCount = Object.keys((doc.paths as Record<string, unknown>) ?? {}).length;
  console.log(`[openapi] wrote ${OUT} — openapi ${doc.openapi as string}, ${pathCount} paths`);
}

main().catch((err) => {
  console.error('[openapi] generation failed:', err);
  process.exit(1);
});

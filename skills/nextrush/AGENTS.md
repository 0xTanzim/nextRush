# AGENTS.md — NextRush (auto-loaded agent context)

This file is part of the **nextrush** Agent Skill. Compatible hosts often load `AGENTS.md`
into context automatically when the skill is installed. Treat it as standing orders for any
task that builds, debugs, or deploys a **NextRush** application.

For full progressive-disclosure docs, read **`SKILL.md`** in this same directory, then the
relevant file under **`references/`**.

---

## What NextRush is

Runtime-independent, web-standards-first TypeScript backend framework.

- Core speaks `Request` / `Response` / `ReadableStream` / `AbortSignal` only
- Same app code → Node, Bun, Deno, Cloudflare Workers, Vercel/Netlify Edge, AWS Lambda, GCF,
  Azure Functions, or **inside Next.js App Router**
- Dual paradigm: **functional** (`nextrush`) and **class + DI** (`nextrush/class`)
- Do **not** invent Express / Fastify / Nest / Hono APIs. Use real NextRush packages and Context
  methods from this skill.

---

## Mandatory: load the skill body

Before writing NextRush application code, **read `SKILL.md`** (same folder as this file).

Then load only the references you need:

| Task | Read |
|------|------|
| Functional routes | `references/functional-api.md` |
| Controllers / DI / guards | `references/class-api.md` |
| Middleware choice/order | `references/middleware.md` |
| Context methods | `references/context.md` |
| Errors | `references/errors.md` |
| Adapter pick | `references/adapters.md` |
| Edge / Lambda / GCF / Azure | `references/serverless-edge.md` |
| Next.js `route.ts` | `references/nextjs.md` |
| SSE / NDJSON | `references/streaming.md` |
| WebSocket / events | `references/websocket-events.md` |
| Tests | `references/testing.md` |
| Scaffold / CLI | `references/scaffolding.md` |
| Architecture | `references/architecture.md` |
| Do / don't checklist | `references/best-practices.md` |

If `SKILL.md` and memory disagree, **code + package README win** — then fix the skill.

---

## Golden paths (copy these shapes)

### Standalone API (Node)

```typescript
import { createApp, serve, errorHandler } from 'nextrush';
import { bodyParser } from '@nextrush/body-parser';

const app = createApp();
app.use(errorHandler());
app.use(bodyParser());
app.get('/health', (ctx) => ctx.json({ ok: true }));
await serve(app, { port: 8080 });
```

### Next.js App Router

```typescript
// app/api/[[...route]]/route.ts
import { handle } from 'nextrush/nextjs';
import { app } from '@/server/app';
export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(app);
```

Mount prefixes live on the **app** (`app.route('/api', router)`), not on `handle()`.

### Edge (Cloudflare)

```typescript
import { createCloudflareHandler } from '@nextrush/adapter-edge';
export default createCloudflareHandler(app);
```

### Serverless (AWS Lambda)

```typescript
import { createLambdaHandler } from '@nextrush/adapter-serverless';
// Module scope — once per cold start
const app = createApp();
export const handler = createLambdaHandler(app);
```

### Class + DI

```typescript
import { Controller, Get, Service, registerControllers } from 'nextrush/class';
await registerControllers(app, { root: './src', prefix: '/api' });
```

### Scaffold

```bash
pnpm create nextrush my-api
```

---

## Hard rules (never violate)

1. **errorHandler outermost** — first `app.use(errorHandler())`.
2. **bodyParser before `ctx.body` / `@Body()`**.
3. Context responses: `ctx.status` + `ctx.json` / `ctx.send` / `ctx.html` / `ctx.redirect`.
   Use `ctx.throw(status, msg)` / `ctx.assert(...)`. **Do not invent** `ctx.ok()`, `ctx.created()`.
4. Streaming: `ctx.sse` / `ctx.ndjson` / `ctx.stream` / `ctx.sendStream` — see `references/streaming.md`.
5. **Capability over identity**: on Lambda/edge, `ctx.runtime` is often `'edge'`. Use
   **`ctx.platform`** (`'lambda' | 'gcf' | 'azure' | 'cloudflare-workers' | …`), not
   `ctx.runtime === 'node'`.
6. Serverless: `createApp()` + handler factory at **module scope**, never inside the handler.
7. Next.js: **App Router only**. Pages Router unsupported. Route file is bridge-only.
8. WebSocket (`@nextrush/websocket`): **Node only**; needs both `upgrade()` and `attach(server)`.
   Prefer SSE on edge.
9. Shared app code destined for edge: **no `node:*` / `fs` / `Buffer`**.
10. Packages are **ESM-only**. Prefer `pnpm`.
11. Validation: `@nextrush/validation` + Zod at the boundary; failures need `errorHandler`.
12. Tests: `@nextrush/testing` (`createTestModule`) for class modules; `app.handle(new Request(...))`
    for functional.

---

## Adapter cheat sheet

| Host | Entry |
|------|--------|
| Node | `serve` / `listen` from `nextrush` |
| Bun / Deno | `@nextrush/adapter-bun` / `adapter-deno` |
| Cloudflare / Vercel Edge / Netlify Edge | `@nextrush/adapter-edge` |
| AWS Lambda / GCF / Azure | `@nextrush/adapter-serverless` |
| Next.js App Router | `handle` from `nextrush/nextjs` |

Full tree: `references/adapters.md` + `references/serverless-edge.md` + `references/nextjs.md`.

---

## Package names (do not guess)

```
nextrush                    # functional meta-package
nextrush/class              # decorators, DI, guards, modules
nextrush/nextjs             # Next App Router bridge

@nextrush/core @nextrush/router @nextrush/di @nextrush/types @nextrush/errors
@nextrush/runtime @nextrush/stream @nextrush/testing @nextrush/dev
create-nextrush

@nextrush/adapter-node | adapter-bun | adapter-deno
@nextrush/adapter-edge | adapter-serverless | adapter-nextjs

@nextrush/cors @nextrush/helmet @nextrush/body-parser @nextrush/multipart
@nextrush/validation @nextrush/rate-limit @nextrush/compression @nextrush/cookies
@nextrush/csrf @nextrush/static @nextrush/template @nextrush/logger @nextrush/timer
@nextrush/request-id @nextrush/health @nextrush/openapi

@nextrush/websocket @nextrush/events
```

Middleware is **not** bundled into bare `nextrush` — install packages you need.

---

## Scope of this AGENTS.md

- **In scope:** building applications *with* NextRush (public API, adapters, patterns).
- **Out of scope:** contributing to the NextRush monorepo internals (use the framework repo’s
  root `AGENTS.md` + OpenSpec + package `ARCHITECTURE.md` for that).

---

## Install (for humans / other agents)

```bash
npx skills add https://github.com/0xTanzim/nextRush --skill nextrush
```

After install, this `AGENTS.md` + `SKILL.md` + `references/` should live together under the
host’s skills directory (e.g. `.agents/skills/nextrush/`). Keep the folder intact — do not
ship `SKILL.md` without `references/` or this file.

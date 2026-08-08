# NextRush Best Practices (for agents & humans)

## Product principles (from framework constitution)

1. Reduce user work — framework owns complexity
2. One obvious golden path that copy-paste-runs
3. Smaller public API > clever API
4. Runtime independence proven by tests, not assumed
5. Docs and errors teach: what / why / how to fix

## App structure

```
src/
  server/ or src/
    app.ts              # compose only
    routes/             # HTTP mapping
    services/           # domain (no ctx)
    controllers/        # class paradigm
    guards/ filters/
  index.ts              # adapter entry ONLY
```

- Handlers: parse/validate → one service call → map status/body
- Services: pure domain, injectable, unit-testable
- Never put DB/authz pricing rules inside route closures long-term

## Middleware

Recommended order:

1. `errorHandler`
2. `requestId`, `timer`, `logger`
3. `helmet`, `cors`
4. `compression`, `cookies`, `csrf`
5. `bodyParser` / `multipart`
6. `rateLimit`
7. routes + `validate(...)`
8. `static`, `openapi`, `notFoundHandler`

## Validation

- Prefer `@nextrush/validation` + Zod at the boundary
- Coerce IDs with `z.coerce.number()` or `@Param('id', { transform: Number })`
- Never trust `ctx.body` shape without schema

## Errors

- Throw `HttpError` subclasses or `ctx.throw(status, msg)`
- Do not return error objects as 200 JSON
- Production: `includeStack: false`
- Map domain failures to correct 4xx; unexpected → 500

## Multi-runtime

- Shared code: Web APIs only
- Platform secrets: bindings / env injection at adapter edge
- Feature flags: capabilities or `ctx.platform`, never `runtime === 'node'` guesses on serverless
- Test critical paths under conformance or via `app.callback()` 

## Serverless / edge

- Module-scope `createApp()` + handler factory
- Stateless handlers; externalize sessions
- Use `ctx.waitUntil` for non-blocking analytics
- Prefer SSE streaming over huge buffered JSON
- Lambda streams → `createLambdaStreamingHandler`

## Next.js

- Catch-all `app/api/[[...route]]/route.ts`
- Single composed `app` export
- Align URL prefix with `app.route('/api', ...)`
- Keep Next UI and NextRush API cleanly separated packages/folders

## Class DI

- `@Service` for business services; constructor injection by type
- Guards for authz; filters for error shaping; interceptors for cross-cutting transform
- `registerModule` for large graphs; `createTestModule` for tests
- Lifecycle: implement `onInit` / `onShutdown` duck-typing when needed

## Performance

- Avoid per-request heavy alloc in hot middleware
- Stream large payloads
- Don't layer redundant body parsers
- Prefer router segment trie (built-in) — don't reinvent regex routers

## Security baseline

```typescript
app.use(errorHandler({ includeStack: false }));
app.use(helmet());
app.use(cors({ origin: ALLOWED, credentials: true }));
app.use(rateLimit({ windowMs: 60_000, max: 100 }));
app.use(bodyParser({ limit: '1mb' }));
// csrf for cookie session browser apps
```

## What agents must NOT do

- Invent APIs (`ctx.ok`, magic globals)
- Put `listen()` inside Next.js route handlers
- Import `fs` into edge-targeted shared modules
- Skip `errorHandler`
- Mock the world instead of using `@nextrush/testing` / `app.callback`
- Create a second competing framework layer on top of NextRush

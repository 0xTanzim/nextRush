# @nextrush/express-bridge

> Opt-in Express/Connect middleware compatibility for NextRush apps running on Node-shaped raw HTTP.

[![npm version](https://img.shields.io/npm/v/@nextrush/express-bridge.svg)](https://www.npmjs.com/package/@nextrush/express-bridge)
[![types](https://img.shields.io/npm/types/@nextrush/express-bridge.svg)](https://www.npmjs.com/package/@nextrush/express-bridge)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/express-bridge.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Reuse Express/Connect 3-arity middleware (`req, res, next`) inside NextRush |
| **Package type** | Interop |
| **Status** | Beta 🚧 |
| **Included in `nextrush`?** | ❌ No — standalone install |
| **Support tier** | `Public — interop` — see [ADR-0026](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0026-public-interop-tier.md) |
| **Maintenance** | Active |
| **Runtime** | Node-shaped raw HTTP only (not Edge/serverless fetch) |
| **Requires** | Node `>=22` · ESM-only · TypeScript `>=5.x` |
| **Introduced** | `v0.1.0` |

## Highlights

- ✅ **One function** — `compat(fn)`; the foreign package keeps its own config API
- ✅ **Contract adapter, not an Express emulator** — core never imports Express
- ✅ **Fail-closed errors** — unsupported APIs and wrong runtime shape teach, never `TypeError`
- ✅ **Zero unused-path cost** — no import edge from core/router/types/runtime/adapters
- ✅ **Fully typed** — strict TypeScript, sealed public surface

## The problem

NextRush ships first-party middleware for CORS, Helmet, cookies, compression, body parsing, multipart,
rate limiting, CSRF, and logging. It does **not** ship a way to reuse the remaining Express/Connect
`(req, res, next)` execution contract for packages the framework doesn't own — Passport, Morgan,
Connect utilities, and community auth strategies.

```ts
// TODAY, without this package — the unsanctioned, broken escape hatch:
app.use(async (ctx) => {
  someExpressMiddleware(ctx.raw.req, ctx.raw.res, (err) => {
    // next(err) does NOT enter Application.handleError
    // res.send does NOT set ctx.responded
  });
});
```

## When to use

**Use `@nextrush/express-bridge` if:**

- ✓ You need an Express/Connect package with no native `@nextrush/*` equivalent (Passport, Morgan)
- ✓ You run on `@nextrush/adapter-node` (or any adapter exposing Node-shaped `ctx.raw`)

**Reach for something else if:**

- ✗ A native package exists → use [`@nextrush/cors`](../middleware/cors), [`@nextrush/helmet`](../middleware/helmet), etc.
- ✗ You need Edge/serverless portability → use native `@nextrush/*` middleware
- ✗ You need streaming/proxy/session → not claimed in v1

---

## Installation

```bash
pnpm add @nextrush/express-bridge
# npm i @nextrush/express-bridge · yarn add @nextrush/express-bridge · bun add @nextrush/express-bridge
```

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { compat } from '@nextrush/express-bridge';
import morgan from 'morgan';

const app = createApp();

app.use(compat(morgan('combined')));
app.use((ctx) => ctx.json({ ok: true }));

listen(app, 8080);
```

The bridge wraps the Express middleware as a NextRush `Middleware`; `morgan` keeps its own config.

## Capabilities

**Capabilities**
- **`compat(fn)`** — wrap a 3-arity Connect/Express middleware as NextRush `Middleware`
- **Continuation translation** — `next()`, `next(err)`, terminal responses, thenables, double-`next`
- **Four-bucket Proxy** — Express overlay / unsupported trap / Node pass-through / ad-hoc `ctx.state`
- **Actionable errors** — `ExpressBridgeCapabilityError`, `ExpressBridgeArityError`, `ExpressBridgeProtocolError`, `UnsupportedExpressApiError`

**Developer experience**
- **Explicit, not magic** — no auto-detection of foreign middleware in `Application.use`

## Mental model

`compat()` adapts the **contract**, not the framework. The bridge hands foreign middleware a
measured Express-like `req`/`res` (a Proxy over the real Node pair) and translates `next` into
`compose()`'s onion.

```text
request ──▶ NextRush compose() ──▶ compat(fn) ──▶ Express middleware
                                     │
                                     └─ next()/next(err)/terminal ──▶ compose() continuation
```

**Rule:** bridge the contract; never put Express in core, and prefer native `@nextrush/*` when it exists.

> [!TIP]
> The full request lifecycle (Mermaid) is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Run Morgan

```ts
import morgan from 'morgan';
app.use(compat(morgan('tiny')));
```

### Run Passport (session-less)

```ts
import passport from 'passport';
app.use(compat(passport.initialize()));
app.use(compat((req, res, next) => {
  // req.user is visible downstream as ctx.state.user
  req.user = { id: 'u1' };
  next();
}));
app.use((ctx) => ctx.json({ user: ctx.state.user ?? null }));
```

### Set a cookie with Express semantics

```ts
app.use(compat((req, res) => {
  res.cookie('sid', 'x', { maxAge: 1000 }); // milliseconds → Max-Age=1
  res.json({ ok: true });
}));
```

## API overview

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `compat` | `(fn: ExpressMiddleware) => Middleware` | `0.1.0` | Stable ✅ | Wrap one Express/Connect middleware |
| `ExpressBridgeCapabilityError` | `class` | `0.1.0` | Stable ✅ | Wrong `ctx.raw` shape |
| `ExpressBridgeArityError` | `class` | `0.1.0` | Stable ✅ | Array / 4+-arity / non-function |
| `ExpressBridgeProtocolError` | `class` | `0.1.0` | Stable ✅ | Hanging thenable |
| `UnsupportedExpressApiError` | `class` | `0.1.0` | Stable ✅ | Unsupported Express API |
| `type ExpressMiddleware` | `(req, res, next) => unknown` | `0.1.0` | Stable ✅ | The wrapped contract |
| `type ExpressNext` | `(err?) => void` | `0.1.0` | Stable ✅ | Express continuation |

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | `4.x` |
| Node.js | `>=22` |
| TypeScript | `>=5.x` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js `>=22` | ✅ | ESM-only, Node-shaped `ctx.raw` |
| Bun / Deno (Node-compat raw) | ⚠️ | not claimed in v1 (follow-up probe) |
| Edge / serverless fetch | ❌ | Web-shaped `ctx.raw` — refused with an actionable error |

**Integration**
- **Peer dependencies:** none
- **Works with:** `@nextrush/core`, `@nextrush/adapter-node`
- **Incompatible with:** bridged body parsers mixed with native `@nextrush/body-parser` (pick one)

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** — no CommonJS build.

---

## Troubleshooting

<details>
<summary><strong><code>@nextrush/express-bridge cannot run on this request</code></strong></summary>

**Cause:** `ctx.raw` is Web-shaped (Edge/serverless fetch). · **Fix:** prefer a native `@nextrush/*` package, or run on `@nextrush/adapter-node`.

</details>

<details>
<summary><strong>Middleware neither called next() nor finished the response</strong></summary>

**Cause:** an `async` middleware returned a thenable without `next()` or a response. · **Fix:** call `next()` after the async work, or send a response.

</details>

## FAQ

**Can I use this without `nextrush`?**
No — it wraps NextRush `Middleware`; you need a NextRush `Application`.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Node-shaped `ctx.raw` is required. Edge/serverless fetch is refused; Bun/Deno Node-compat is a follow-up probe, not a v1 claim.

**Why isn't it `@nextrush/connect-bridge`?**
The package name targets the largest ecosystem (Express); the actual contract is the narrower Connect/Express 3-arity model.

---

## Package relationships

```text
                        depends on            @nextrush/types · errors · runtime
@nextrush/express-bridge ──────────────▶
                        often used with       @nextrush/core · adapter-node
                        usually used next     @nextrush/* (native, preferred)
```

- **Depends on:** [`@nextrush/types`](../types), [`@nextrush/errors`](../errors), [`@nextrush/runtime`](../runtime)
- **Often used with:** [`@nextrush/core`](../core) — `app.use(compat(fn))`
- **Usually used next:** [`@nextrush/cors`](../middleware/cors) — the native golden path when it exists
- **Alternative:** native `@nextrush/*` middleware — always preferred when available

## Architecture

Maintaining or contributing to this package? The internal design — module layout, request
lifecycle, invariants, decisions and trade-offs (with diagrams) — is in
**[`ARCHITECTURE.md`](./ARCHITECTURE.md)**. Design history:
[`docs/RFC/ecosystem-interop/035-express-bridge.md`](../../docs/RFC/ecosystem-interop/035-express-bridge.md).

## Resources

- 📖 **Learn** — [Documentation](https://0xtanzim.github.io/nextRush/docs) · [Architecture](./ARCHITECTURE.md) · [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- 🐛 **Report an issue** — [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- 🤝 **Contribute** — [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT © [Tanzim Hossain](https://github.com/0xTanzim)

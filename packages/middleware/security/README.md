# @nextrush/security

> One call that applies helmet, strict cookies, CSRF protection, and rate limiting together —
> the secure-by-default composite for apps that don't want to wire four packages by hand.

[![npm version](https://img.shields.io/npm/v/@nextrush/security.svg)](https://www.npmjs.com/package/@nextrush/security)
[![types](https://img.shields.io/npm/types/@nextrush/security.svg)](https://www.npmjs.com/package/@nextrush/security)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/security.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Composite secure-by-default preset — helmet + cookies + CSRF + rate limit in one call |
| **Package type** | Middleware (composite) |
| **Status** | Stable ✅ |
| **Included in `nextrush`?** | ❌ No — install separately |
| **Runtime** | Node (composed layers are per-adapter; see [Compatibility](#compatibility)) |
| **Requires** | Node `>=22` · ESM-only · TypeScript `>=5.x` |
| **Introduced** | `v1.0.0` |

## Highlights

- ✅ **One call, four layers** — helmet, cookies, CSRF, rate limit, applied in a fixed, safe order
- ✅ **Fails fast** — every layer is built eagerly at construction, so an incomplete required
  option (CSRF's `secret`/session config) throws immediately, never on the first request
- ✅ **Per-layer overrides** — pass options straight through to any layer without dropping the
  others
- ✅ **ESM-only**, fully typed, zero `any`

## The problem

Wiring a secure baseline by hand means importing four packages, remembering their interaction
order (helmet before routes; CSRF after cookies are parsed; rate limiting before expensive work),
and re-discovering each one's required configuration on your own:

```ts
// TODAY, without this package — four imports, and the order is on you to get right:
import { helmet } from '@nextrush/helmet';
import { cookies } from '@nextrush/cookies';
import { csrf } from '@nextrush/csrf';
import { rateLimit } from '@nextrush/rate-limit';

app.use(helmet());
app.use(cookies());
app.use(rateLimit());
const { protect } = csrf({ secret, getSessionIdentifier });
app.use(protect);
```

Nothing stops the order from drifting, and nothing tells you at a glance whether an app has all
four layers or only two.

## When to use

**Use `@nextrush/security` if:**

- ✓ You want a secure baseline in one line, and are fine with the composed order (helmet → cookies
  → rate limit → CSRF).
- ✓ Every layer's defaults, or straightforward per-layer overrides, meet your needs.

**Reach for something else if:**

- ✗ You need a different layer order, or a layer this preset doesn't include (e.g. `@nextrush/csp`
  fine-tuning beyond what `helmet` exposes) → compose `@nextrush/{helmet,cookies,csrf,rate-limit}`
  directly.
- ✗ You don't need CSRF (e.g. a pure JSON API with no cookie-based session) → `security()` still
  requires CSRF configuration, since it is the one layer with no safe zero-config default; compose
  the other three directly instead.

---

## Installation

```bash
pnpm add @nextrush/security
# npm i @nextrush/security · yarn add @nextrush/security · bun add @nextrush/security
```

> [!NOTE]
> Not included in the `nextrush` meta package — install it separately.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { security } from '@nextrush/security';

const app = createApp();

app.use(
  security({
    csrf: {
      secret: process.env.CSRF_SECRET!,
      getSessionIdentifier: (ctx) => ctx.state.sessionId as string,
    },
  })
);

listen(app, 8080);
```

Helmet's header set, cookie parsing, rate limiting, and CSRF protection are now all active — the
only configuration required is CSRF's, because it is the one layer with no safe zero-config
default.

## Capabilities

**Capabilities**
- **Composite preset** — one middleware combining `helmet()` + `cookies()` + `rateLimit()` + the
  CSRF `protect` middleware, in that fixed order
- **Eager construction** — every layer builds at `security()` call time; a missing required option
  throws there, not on the first request

**Developer experience**
- **Per-layer overrides** — `{ helmet, cookies, csrf, rateLimit }` map directly onto each layer's
  own options type
- **Fully typed** — strict TypeScript, zero `any`

## Mental model

```text
request ──▶ helmet ──▶ cookies ──▶ rateLimit ──▶ csrf.protect ──▶ your routes
```

**Rule:** the order is fixed and not configurable — security headers land before anything else
runs, rate limiting runs before CSRF's cryptographic comparison, and CSRF runs last, immediately
before your route handlers.

> [!TIP]
> The full composition diagram is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Override one layer without dropping the others

```ts
app.use(
  security({
    csrf: { secret, getSessionIdentifier },
    rateLimit: { max: 20, window: '1m' },
  })
);
```

### Use in a JSON API with unbound CSRF (no session store yet)

```ts
app.use(
  security({
    csrf: { secret, sessionBinding: 'none' },
  })
);
```

## API overview

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `security` | `(options: SecurityPresetOptions) => Middleware` | `1.0.0` | Stable ✅ | Builds the composite preset |
| `type SecurityPresetOptions` | — | `1.0.0` | Stable ✅ | Per-layer configuration |

## Options

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `helmet` | `HelmetOptions` | No | helmet's own defaults | — | Passed to `helmet()` |
| `cookies` | `CookieMiddlewareOptions` | No | cookies' own defaults (`secure: 'auto'`) | — | Passed to `cookies()` |
| `csrf` | `CsrfOptions` | **Yes** | — | ⚠️ | Passed to `csrf()`; requires `secret` and either `getSessionIdentifier` or `sessionBinding: 'none'` |
| `rateLimit` | `RateLimitOptions` | No | rate-limit's own defaults | — | Passed to `rateLimit()` |

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | `3.x` |
| Node.js | `>=22` |
| TypeScript | `>=5.x` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js `>=22` | ✅ | ESM-only |
| Bun / Deno / Edge | Depends on the composed layer | Each of helmet/cookies/csrf/rate-limit runs on every adapter; `security()` itself adds no platform-specific code |

**Integration**
- **Peer dependencies:** `@nextrush/core`, `@nextrush/cookies`, `@nextrush/csrf`, `@nextrush/helmet`, `@nextrush/rate-limit`, `@nextrush/types`
- **Works with:** any NextRush application (`createApp()`)
- **Incompatible with:** registering `helmet()`/`cookies()`/`csrf()`/`rateLimit()` a second time for the same concern — that duplicates headers/cookies/checks

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** — no CommonJS build. On Node `>=22`, CJS consumers can
> `require()` this ESM package natively. See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong><code>csrf() requires either a getSessionIdentifier function or an explicit sessionBinding: 'none' acknowledgement</code></strong></summary>

**Cause:** `security()` builds `csrf()` eagerly, and CSRF has no safe zero-config default. **Fix:**
supply `csrf: { secret, getSessionIdentifier }` (session-bound, recommended) or
`csrf: { secret, sessionBinding: 'none' }` (unbound double-submit, intentional opt-in).

```ts
app.use(security({ csrf: { secret, getSessionIdentifier: (ctx) => ctx.state.sessionId } } ));
```

</details>

## FAQ

**Can I compose the four layers myself instead of using this preset?**
Yes — `security()` is a convenience composition, not a new capability. `@nextrush/{helmet,cookies,csrf,rate-limit}` remain independently usable and documented.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Each composed layer runs on every adapter; there's nothing platform-specific in `security()` itself.

**Can I reorder the layers?**
No — the order (helmet → cookies → rate limit → CSRF) is fixed. Compose the four packages directly if you need a different order.

---

## Package relationships

```text
                 depends on            @nextrush/{core,helmet,cookies,csrf,rate-limit,types}
@nextrush/security ──────────────▶
                 often used with       @nextrush/session (once it ships — see RFC-032)
                 usually used next     none — this is typically the last security layer added
```

- **Depends on:** [`@nextrush/helmet`](../helmet), [`@nextrush/cookies`](../cookies), [`@nextrush/csrf`](../csrf), [`@nextrush/rate-limit`](../rate-limit) — the four composed layers
- **Alternative:** compose the four packages directly for a different layer order or a subset

## Architecture

Maintaining or contributing to this package? The internal design is in
**[`ARCHITECTURE.md`](./ARCHITECTURE.md)**. Design history:
[`openspec/changes/harden-security-boundaries/design.md`](../../../../openspec/changes/harden-security-boundaries/design.md) (D8).

## Resources

- 📖 **Learn** — [Documentation](https://0xtanzim.github.io/nextRush/docs) · [Architecture](./ARCHITECTURE.md) · [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- 📝 **Changelog** — [CHANGELOG.md](./CHANGELOG.md)
- 🐛 **Report an issue** — [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- 🤝 **Contribute** — [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT © [Tanzim Hossain](https://github.com/0xTanzim)

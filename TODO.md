# TODO — Road to 1.0

Status board reconciled against the actual tree (2026-07). Historical detail lives in git
history and the ADRs (`docs/adr/`); this file tracks only what remains.

Legend: `[x]` done · `[ ]` remaining

---

## Extension Model v4 — SHIPPED ✅

`RFC-NEXTRUSH-PLUGIN-SYSTEM.md` (APPROVED) is implemented. Decision recorded in
`docs/adr/ADR-0002-extension-model.md`.

- [x] Core `Extension` contract (`extend()` / `ready()` / `destroy`); `Plugin` surface deleted
- [x] Adapters await `ready()`; meta wires batteries-included `createApp`
- [x] App-owned router (R1) + per-app DI container plumbing
- [x] Package reclassification (middleware / registrar / extension)
- [x] Consumers migrated (playground, examples, create-nextrush, dev generators)
- [x] Docs rewritten to the extension model (zero old-API references outside historical files)

## Class-Based Runtime — SHIPPED ✅

Consolidated into `@nextrush/class` (`docs/adr/ADR-0003`), immutable Application Graph +
single reflection boundary (`ADR-0004`), sealed public surface (`ADR-0005`).

- [x] Request-scoped DI (`scope: 'request'`, per-request child container, bubbling)
- [x] Interceptors (before/after-handler onion)
- [x] Exception filters (declarative per-controller/route error mapping)
- [x] Lifecycle hooks (`OnInit` / `OnShutdown`)
- [x] Modules (`@Module`, `registerModule`, imports/compose) — grouping (not yet encapsulation)
- [x] `@HttpCode()` decorator
- [x] `@nextrush/testing` harness, opt-in diagnostics, consolidate-imports codemod
- [x] `@nextrush/class` source organized into the RFC §4 folder layout

## M8 — Release (1.0.0-rc → 1.0.0)

- [ ] Full workspace forced-green `typecheck` + `build` + `test` (currently 56 / 37 / 72)
- [ ] Reconcile the accumulated changeset set into a coherent release
- [ ] CHANGELOG + finalize the migration guides
- [ ] Tag `1.0.0-rc`; tag `1.0.0` once the RC bakes

## Deferred to 1.x (decisions recorded in `docs/adr/ADR-0006`)

These are net-new public surface; each needs its own approved RFC before implementation
(repo iron law: *RFC before implementation* for public APIs). None block 1.0.

- [ ] **Module encapsulation** — enforce `@Module.exports` / module-private providers
      (today modules group + compose; `exports` is recorded, not enforced). Highest-value next feature.
- [ ] **Full per-app DI isolation by default** — flip opt-in `isolate` to default
      (`docs/RFC/RFC-NEXTRUSH-DI-CONTAINER-OWNERSHIP.md`); breaking, hence 2.0.
- [ ] **Request-pipeline observability** — metrics/trace hooks around guard→interceptor→handler→filter.
- [ ] **Typed layered configuration** — env/file/defaults convention for class apps.

## Deprecation window (see `docs/adr/ADR-0005`)

- [ ] Remove the `@nextrush/decorators` and `@nextrush/controllers` compatibility shims in the
      next major after 1.0 (they re-export from `@nextrush/class`; codemod:
      `nextrush codemod consolidate-imports`).

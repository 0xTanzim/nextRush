# NextRush — Production Roadmap

> **Companion to:** `01-production-readiness-audit.md` (findings R-1…R-14).
> **Purpose:** sequence the work from today's Beta to a credible, API-frozen v1.0 across Node, edge, serverless, and enterprise.
> **Effort legend:** **S** = Small (< 1 week) · **M** = Medium (1–3 weeks) · **L** = Large (1–2 months) · **XL** = Very Large (2+ months / multi-quarter).
> **Discipline note:** the repo enforces test-first (RED→GREEN→REFACTOR) and RFC-before-implementation for public API. Every roadmap item below assumes an RFC (for new public surface) + tests land in the same change.

---

## 1. Current State

**What exists and is strong (verified):**
- Runtime-agnostic core (`types/errors/core/router/runtime/stream` — 0 `node:` imports), strict TS, zero `any` in shipping code, 145 test files, prior hardening passes.
- Real adapters for Node, Bun, Deno, Edge + a cross-adapter `conformance` suite.
- Production-grade Node lifecycle: graceful drain + timeouts + normalized startup errors (`adapter-node/src/adapter.ts`).
- Broad middleware set incl. CORS, Helmet, CSRF, rate-limit, compression, signed cookies, Standard-Schema validation, OpenAPI 3.1, SSE/NDJSON streaming.
- Changesets release automation with npm provenance (`.github/workflows/release.yml`).

**What is missing or unproven (verified):**
- Multi-runtime CI (Node-only), observability (no OTel/metrics/health), signal-wired graceful shutdown, auth/authz/session, classic serverless adapters, bundle-size budget.
- Accuracy debt: "Zero Dependencies" (false for DI path: `tsyringe` + `reflect-metadata`), segment trie shipped as `radix-tree.ts`/`RadixNode`.

**Positioning reality:** already published at `3.x` on npm with deprecated shim packages — the "preparing v1" framing needs a clear semver/stability narrative.

---

## 2. Vision

> **A minimal, type-safe, runtime-portable HTTP framework whose *functional core* is dependency-free and provably runs identically on Node, Bun, Deno, and the edge — with an *opt-in* class/DI paradigm and a batteries-available (not batteries-forced) ecosystem for auth, observability, and data.**

Three commitments define v1:
1. **Prove, don't assert.** Every advertised runtime is exercised on that runtime in CI.
2. **Honest core, rich edges.** Keep the core tiny and dependency-free; ship capabilities as separately-installed, tree-shakeable packages.
3. **Freeze deliberately.** A published, testable definition of the v1 public surface with a support/compat matrix.

---

## 3. Gap Analysis

| Capability | Current | Target for v1 | Gap size | Risk ref |
|---|---|---|---|---|
| Multi-runtime CI | Node-only, simulated | Real Bun/Deno/workerd + Node matrix | **L** | R-1 |
| Graceful shutdown | Manual `close()` | Signal-wired opt-in + docs | **S** | R-3 |
| Observability | request-id + logger | OTel + metrics + health | **XL** | R-4 |
| Auth/identity | none | auth + JWT + sessions | **XL** | R-5 |
| Serverless (classic) | none | Lambda/GCF/Azure adapter + cold-start bench | **M** | R-6 |
| Bundle-size budget | none | CI size check vs CF 1MB | **S** | R-12 |
| Accuracy (deps/router naming) | drifted | corrected + ADRs | **S** | R-2,R-7 |
| Decorator dialect | legacy, undocumented exit | ADR + isolated reflection boundary | **M** | R-8 |
| Cache / config / queue | none | cache + env-config, then queue | **L** | — |
| Governance / support policy | single maintainer | compat matrix + contributors | **M** | R-10 |

---

## 4. Milestones

| Milestone | Theme | Exit criterion | Target |
|---|---|---|---|
| **M0 — Truth & Trust** | Fix accuracy debt; prove runtimes | R-1, R-2, R-7 closed; CI green on all advertised runtimes | v1.0-rc.1 gate |
| **M1 — Operable Node** | Node production ergonomics | R-3, R-11, R-12, health package | "Node Production Ready" (§14) |
| **M2 — Observable** | Tracing + metrics | OTel + metrics + correlation propagation | Enterprise pilot-ready |
| **M3 — Secure** | Identity | auth + JWT + sessions with secure defaults | Enterprise adoption-ready |
| **M4 — Everywhere** | Edge + serverless GA | Edge proven (§15); serverless adapter GA (§16) | "Edge/Serverless Ready" |
| **M5 — Freeze** | API freeze + governance | v1 surface test locked; support matrix published | **v1.0.0** |

---

## 5. P0 — Blocking v1 (must land before any "stable/production" claim)

### P0-1 · Real multi-runtime CI + Node matrix — **[R-1] · Effort: L**
- Add CI jobs: `bun test` on real Bun, `deno test` on real Deno, `workerd`/miniflare for Workers, and a Node matrix (20 LTS, 22, 24).
- Run the `conformance` suite on each real runtime, not just under vitest/Node.
- **Done when:** a runtime regression in any adapter fails CI on that runtime.

### P0-2 · Accuracy corrections — **[R-2, R-7] · Effort: S**
- Reword "Zero Dependencies" → "zero-dependency functional core; class/DI path uses `tsyringe` + `reflect-metadata`."
- Rename `radix-tree.ts`→`segment-trie.ts`, `RadixNode`→`TrieNode`; fix JSDoc + npm keywords/description.
- **Done when:** README, package descriptions, and source names match the implementation.

### P0-3 · Public-surface freeze harness — **[R-10] · Effort: M**
- Extend the existing `public-surface.test.ts` pattern into an API-report snapshot (e.g. `@microsoft/api-extractor` or an export-diff test) for every published package; wire into CI so any surface change requires an intentional snapshot update + changeset.
- **Done when:** an accidental public-API change fails CI.

### P0-4 · Version/stability narrative — **[R-10] · Effort: S**
- Publish a compatibility matrix (which package versions are v1-stable), a support policy, and a statement resolving "3.x on npm vs marketed v1."
- Deprecate/*unpublish-plan* the `@nextrush/controllers` and `@nextrush/decorators` shims with a removal timeline.

---

## 6. P1 — Required before stable v1

### P1-1 · Signal-wired graceful shutdown — **[R-3] · Effort: S**
- `serve(app, { gracefulShutdown?: boolean | { signals, timeout } })` and/or a `handleShutdown(server)` helper wiring SIGTERM/SIGINT → drain → `app.close()`. Opt-in (never auto-register handlers silently in a library).
- Document the manual pattern for FaaS/edge where signals differ.

### P1-2 · Health/readiness package — **[R-4] · Effort: S–M**
- `@nextrush/health`: liveness/readiness endpoints + a check-registry (DB/cache pings) usable by k8s probes.

### P1-3 · OpenTelemetry + correlation — **[R-4] · Effort: L**
- `@nextrush/otel`: HTTP server spans, W3C `traceparent` extraction/injection, span attributes from route metadata. Requires a **context-propagation decision** (see P1-3a).
- **P1-3a (design spike, Effort: M):** choose ambient context strategy — `AsyncLocalStorage` (available on Node/Bun/Deno/Workers) vs explicit `ctx`-threaded context. ALS unlocks ergonomic tracing/logging but adds a runtime assumption; document the trade-off in an ADR.

### P1-4 · Metrics — **[R-4] · Effort: M**
- `@nextrush/metrics`: Prometheus/OpenMetrics endpoint + RED metrics (rate/errors/duration) with low-cardinality route labels (use `endpoint()` route metadata).

### P1-5 · Auth foundation — **[R-5] · Effort: L**
- `@nextrush/auth`: strategy abstraction (bearer/JWT/API-key/session), guard integration for the class API, secure defaults (constant-time compare, no secret logging).
- `@nextrush/jwt`: sign/verify with key rotation (Web Crypto `subtle` so it is edge-portable).

### P1-6 · Sessions — **[R-5] · Effort: M**
- `@nextrush/session`: signed-cookie sessions + pluggable store interface (memory default; Redis via P2 cache driver).

### P1-7 · Bundle-size budget — **[R-12] · Effort: S**
- CI size check per package + a documented "minimal edge bundle" recipe; assert the functional core stays under a stated KB budget and flag regressions.

---

## 7. P2 — Important improvements

- **P2-1 · Classic serverless adapter — [R-6] · M.** `@nextrush/adapter-serverless`: APIGW v1/v2, Lambda Function URL (streaming), GCF, Azure event→`Request` mappers + container-reuse pattern + cold-start benchmark.
- **P2-2 · Cache abstraction — L.** `@nextrush/cache` (interface + in-memory) then `@nextrush/redis` driver; unblocks session store + rate-limit distributed store.
- **P2-3 · Env/config validation — M.** `@nextrush/config`: schema-validated env (Standard Schema, reuse validation infra) + secret redaction; complements DI `@Config()`.
- **P2-4 · Distributed rate-limit store — M.** Extend `@nextrush/rate-limit` with a Redis/KV store (currently in-memory only).
- **P2-5 · Decorator-dialect ADR + reflection boundary — [R-8] · M.** Commit v1 to a dialect; isolate `reflect-metadata` behind an internal seam (`ADR-0004`) so a future TC39 migration is contained.
- **P2-6 · Coverage gate — [R-11] · S.** Enforce per-package coverage in CI.
- **P2-7 · Router file split — S.** `router.ts` (28KB) exceeds the project's own router LOC budget; split for maintainability.
- **P2-8 · Reduce/replace tsyringe — [R-2] · L.** Evaluate an in-house container to restore a true zero-runtime-dependency story and drop a maintenance-mode dependency.

---

## 8. P3 — Ecosystem expansion

- **P3-1 · Queue / jobs — L.** `@nextrush/queue` (interface + Redis/BullMQ driver).
- **P3-2 · Cron/scheduler — M.** `@nextrush/cron` (with a note that edge/FaaS scheduling is platform-native).
- **P3-3 · Webhooks — M.** signing/verification + retry helpers.
- **P3-4 · GraphQL adapter — L.** mount a GraphQL handler on the context pipeline.
- **P3-5 · RPC / typed client — L.** end-to-end typed RPC leveraging existing route metadata.
- **P3-6 · Edge-native WebSockets — L.** Cloudflare Durable Objects / `WebSocketPair` path (current WS is Node-coupled, R-13).
- **P3-7 · CommonJS dual-publish — [R-9] · M.** only if CJS reach is a goal.
- **P3-8 · Node-floor policy — [R-14] · S.** document why Node ≥22; reconsider a Node 20 LTS floor if adoption demands.

---

## 9. Dependency Graph (work order)

```
P0-1 (multi-runtime CI) ─────────────┐
P0-2 (accuracy fixes) ───────────────┤
P0-3 (API-freeze harness) ───────────┼──► M0 gate ──► P0-4 (version narrative)
                                      │
P1-7 (bundle budget) ◄── depends on ──┘ (needs edge CI from P0-1)

P1-1 (signal shutdown) ──► M1
P1-2 (health) ──────────► M1
P1-3a (context ADR) ──► P1-3 (OTel) ──► P1-4 (metrics) ──► M2
P1-5 (auth) ──► P1-6 (sessions) ──► M3
                     ▲
P2-2 (cache/redis) ──┘ (session store + distributed rate-limit both consume it)

P0-1 (edge proven) ──► P2-1 (serverless adapter) ──► M4
```

**Critical path to v1:** `P0-1 → M0 → P1-1/P1-2 (M1) → P1-3a→P1-3→P1-4 (M2) → P1-5→P1-6 (M3) → P2-1 (M4) → P0-3 freeze (M5)`.

---

## 10. Recommended Package Order

1. **(P0)** CI runtime matrix, API-freeze harness, accuracy fixes — *no new packages, unblocks everything.*
2. **`@nextrush/health`** (P1-2) — smallest, highest ops value, no deps.
3. **`@nextrush/otel`** + context-ADR (P1-3) — foundational for all observability.
4. **`@nextrush/metrics`** (P1-4) — builds on route metadata + otel context.
5. **`@nextrush/jwt`** → **`@nextrush/auth`** → **`@nextrush/session`** (P1-5/6) — identity stack, JWT first (Web-Crypto, edge-portable).
6. **`@nextrush/cache`** → **`@nextrush/redis`** (P2-2) — unblocks session store + distributed rate-limit.
7. **`@nextrush/config`** (P2-3).
8. **`@nextrush/adapter-serverless`** (P2-1) — after edge is proven in CI.
9. **Ecosystem (P3):** queue → cron → webhooks → graphql/rpc.

*Rationale:* observability and health are cheap, universally needed, and dependency-light; identity is high-value but larger; cache underpins several later packages; serverless waits on proven edge.

---

## 11. Breaking Changes (planned, with versioning)

| Change | Why | Breaking? | Version | Migration |
|---|---|---|---|---|
| Rename `radix-tree.ts`/`RadixNode` → `segment-trie`/`TrieNode` | Accuracy (R-7) | Only if consumers import internals (they shouldn't) | Minor if internal-only; else major | Codemod + `@deprecated` re-export for one cycle |
| Remove `@nextrush/controllers` / `@nextrush/decorators` shims | Consolidated into `@nextrush/class` (already deprecated) | Yes | Major of those packages | Provided codemod (`packages/dev/src/codemods`) already consolidates imports |
| `serve()` gains `gracefulShutdown` option | R-3 | No (additive) | Minor | Opt-in |
| Context-propagation via `AsyncLocalStorage` (if chosen, P1-3a) | Observability ergonomics | Possibly (adds runtime assumption) | Minor (opt-in) / Major (if default) | Feature-flag; ADR |
| Decorator dialect commitment (R-8) | Freeze for v1 | No now; migration to standard decorators later = Major | Documented in ADR-0001 | Deferred; isolate reflection seam first |
| Drop `reflect-metadata`/tsyringe (P2-8, if pursued) | True zero-dep (R-2) | Yes for class path | Major | Compatibility layer + codemod |

**Rule:** every breaking change ships with a changeset (CI-enforced), a migration guide under `docs/migrations/`, and a `@deprecated` window of at least one minor cycle where technically possible.

---

## 12. Migration Strategy

1. **Deprecate-then-remove.** Anything removed at v1 gets a `@deprecated` JSDoc with the replacement, kept for one minor cycle (the repo already does this for `catchAsync`, `ErrorContext`, edge body-source aliases).
2. **Codemods over manual edits.** Extend `@nextrush/dev` codemods (already has `consolidate-imports`) for each rename/removal; ship `nextrush migrate <target>`.
3. **Migration guides in-repo.** Continue the `docs/migrations/*` pattern (before/after, reason, step-by-step) — required by steering for breaking changes.
4. **Compat window.** Publish the support matrix (P0-4) so adopters know which lines receive fixes and for how long.
5. **RC channel.** Cut `v1.0.0-rc.x` after M0 so early adopters validate on real runtimes before GA.

---

## 13. Success Criteria

| Metric | Target | How measured |
|---|---|---|
| Advertised runtimes proven | 100% run their suite on the real runtime in CI | CI jobs (P0-1) |
| Cross-adapter parity | Conformance suite green on Node/Bun/Deno/workerd | `packages/adapters/conformance` |
| Coverage | ≥ 90% lines / 85% branches per package, gated | CI coverage gate (P2-6) |
| Zero `any` in shipping source | Maintained | lint/CI |
| Public API stability | 0 unintended surface changes | API-freeze snapshot (P0-3) |
| Edge minimal bundle | Under a stated KB budget; < CF 1MB with core+router+edge | Bundle-size CI (P1-7) |
| Cold start (functional) | Measured + published (target set after first measurement) | serverless bench (P2-1) |
| Docs accuracy | No claim contradicted by source | doc-validate + review |
| Graceful shutdown | 0 dropped in-flight requests on SIGTERM in an integration test | integration test (P1-1) |

---

## 14. Definition of "Production Ready" (Node.js)

A NextRush Node.js service is **Production Ready** when **all** hold:
- ✅ Graceful shutdown wired to SIGTERM/SIGINT with a drain timeout; an integration test proves no in-flight request is dropped (P1-1).
- ✅ Health/readiness endpoints available (P1-2).
- ✅ Structured logging + request/correlation IDs + OTel traces + RED metrics available and documented (P1-3/1-4).
- ✅ Secure error responses (no stack/message leak in prod — **already true**), enforced body-size limits (**already true**), CORS/Helmet/CSRF/rate-limit available (**already true**).
- ✅ Node version matrix (20 LTS/22/24) green in CI (P0-1).
- ✅ Coverage gate + API-freeze snapshot enforced (P2-6, P0-3).
- ✅ Documented, accurate dependency footprint (P0-2).

*Status today:* ~70% — core lifecycle and security defaults are in place; shutdown wiring, health, and observability are the remaining gaps.

---

## 15. Definition of "Edge Ready" (Cloudflare / Vercel Edge / Netlify Edge / Deno Deploy)

**Edge Ready** when **all** hold:
- ✅ The edge adapter's suite runs on **real** `workerd`/miniflare (and Deno for Deno Deploy/Netlify) in CI — not simulated (P0-1).
- ✅ A published minimal edge bundle is measured and fits platform limits (< 1 MB Workers), with a CI size budget (P1-7).
- ✅ Functional (DI-free) path confirmed to avoid `reflect-metadata`/`node:*` at runtime (**core already 0 `node:`; verified**), with a documented "edge-safe subset" of middleware.
- ✅ Edge-portable identity (JWT via Web Crypto) available (P1-5).
- ✅ Documented limitations: no filesystem, no Node WebSockets/static/multipart-disk on edge (R-13), platform timeout guidance (already in edge adapter).
- ✅ A verified deploy example per platform (CF/Vercel/Netlify/Deno Deploy).

*Status today:* ~55% — implementation and detection are strong; **proof on real runtimes + bundle budget + deploy examples** are missing.

---

## 16. Definition of "Serverless Ready" (Lambda / GCF / Azure / Vercel Functions)

**Serverless Ready** when **all** hold:
- ✅ `@nextrush/adapter-serverless` maps native events (APIGW v1/v2, Lambda Function URL streaming, GCF, Azure) to `Request`/`Response` (P2-1). *(Today: none — verified absent.)*
- ✅ Container-reuse pattern documented (build/`ready()` once per warm instance, handle per invocation).
- ✅ Cold-start measured and published for the functional path; DI/class overhead quantified.
- ✅ Stateless-execution guarantees documented (no cross-invocation mutable state).
- ✅ Timeout/abort behavior verified against platform limits (edge adapter already returns 504 on timeout).
- ✅ At least one verified example per platform.

*Status today:* ~25% for classic FaaS (works only via a user-built bridge); ~55% for fetch-based serverless (shares the edge path).

---

## 17. Definition of "v1.0"

**v1.0.0 ships when M0–M5 are complete and all of the following are true:**

1. **Proven everywhere it claims.** Every advertised runtime runs its suite on that runtime in CI; conformance parity green (P0-1).
2. **API frozen & documented.** Public surface locked by a snapshot test; every export documented; docs contain no claim contradicted by source (P0-3, P0-2).
3. **Operable.** Signal-wired graceful shutdown, health checks, OTel traces, and metrics are available and documented (P1-1…P1-4).
4. **Secure by default & complete enough.** First-party auth + JWT + sessions with secure defaults; existing CORS/Helmet/CSRF/rate-limit/validation retained (P1-5/6).
5. **Honest footprint.** Dependency claims accurate; a documented zero-dependency functional core; class/DI footprint disclosed (P0-2).
6. **Quality locked.** Coverage gate + zero-`any` + lint clean enforced in CI (P2-6).
7. **Governed.** Published support/compatibility matrix, contribution/governance plan, and a resolved semver narrative; deprecated shims removed on a stated timeline (P0-4).
8. **Migration-safe.** Codemods + migration guides for every breaking change; an RC period on real runtimes preceded GA (§11–12).

**Explicitly out of scope for v1 (deferred to post-1.0):** GraphQL/RPC, queue/cron/webhooks, edge-native WebSockets, CommonJS dual-publish, and replacing tsyringe — none block a credible v1 and all are P2/P3.

---

### Appendix — Effort roll-up

| Priority | Items | Aggregate effort |
|---|---|---|
| P0 | 4 | ~1 L + 1 M + 2 S → **≈ 1.5–2 months** |
| P1 | 7 | 2 L + 3 M + 2 S → **≈ 3–4 months** |
| P2 | 8 | 2 L + 4 M + 2 S → **≈ 3–4 months** |
| P3 | 8 | mostly L/M → **multi-quarter** |

**Realistic path to v1.0 (P0+P1+critical P2-1/P2-6):** roughly **2 focused quarters** with 1–2 engineers, contingent on P0-1 landing first. The foundation is sound; the remaining work is breadth, proof, and operational polish — not core rework.

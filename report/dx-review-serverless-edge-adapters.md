# DX Audit — @nextrush/adapter-serverless & @nextrush/adapter-edge

**Date:** 2026-07-25
**Scope:** Developer Experience / Framework Experience only — explicitly excludes architecture,
performance, and security implementation (reviewed separately elsewhere). Covers public APIs,
naming, ergonomics, discoverability, boilerplate/verbosity, error/warning/diagnostic quality,
workflow (install → first deploy → debug → upgrade), abstraction leakage, edge-case/failure-mode
DX, and cross-framework comparison (Hono, Fastify, Elysia, Next.js, NestJS, Nitro).
**Method:** Independent audit via `ux-ui-auditor` sub-agent — a separate context from the one
that most recently wrote/edited documentation for these packages, per this repo's
generator/verifier separation discipline. Read-only; no files were modified during the audit.
**Packages audited:** `packages/adapters/serverless/`, `packages/adapters/edge/` (README.md +
ARCHITECTURE.md read in full for both; `packages/adapters/conformance` checked for what is
actually test-verified vs. only claimed).

---

**Verdict: 6.4/10 overall — solid-to-good, not yet best-in-class.** The core one-liner (`export const handler = createLambdaHandler(app)`) is genuinely competitive with Hono/Nitro. The DX losses are concentrated in three places: **abstraction leakage that the docs apologize for instead of fixing** (`ctx.runtime === 'edge'` on Lambda), **two of three serverless platforms not actually being one-liners**, and **a near-total absence of runtime diagnostics** — a gap made conspicuous by the fact that the sibling `adapter-nextjs` package in the same repo ships a purpose-built `diagnose.ts`. No P0. Four P1s.

---

## 1. Developer journey reconstruction

| Stage | Lambda | Cloudflare | GCF / Azure |
|---|---|---|---|
| Install | 1 cmd, clean | 1 cmd (README correctly tells you to add `@nextrush/core`; serverless README does **not**) | 1 cmd + platform SDK |
| First handler | 3 lines, zero config — excellent | 3 lines — excellent | ~12 lines of hand-written field mapping |
| First deploy | works; `deploy-verification/lambda-app` proves it | proven via wrangler | GCF proven; **Azure unproven** |
| Debug | `console.log` + platform logs only. No diagnose, no dev-mode warning, no request logging hook | same | same, plus your own mapping bugs are invisible |
| Upgrade | CHANGELOG present; tier ambiguity (below) makes semver expectations unclear | tier honestly labelled Internal | — |

The onboarding path is not broken anywhere, which is why there is no P0. The journey degrades sharply the moment you leave AWS or leave the happy path.

---

## 2. Findings

### P1-1 — `ctx.runtime` reports `'edge'` on AWS Lambda, GCF and Azure
- **Package/File/API:** adapter-serverless (inherited) · `edge/src/context.ts:~95` (`detectEdgeRuntime().runtime`) · `ctx.runtime`
- **Current experience:** deploy to Lambda, log `ctx.runtime`, get `'edge'`. Both READMEs document this prominently and serverless adds a troubleshooting entry whose advised fix is "branch on a capability… or check `ctx.env`/platform-specific fields directly."
- **Problem:** the value is not wrong-by-accident, it is a wrong *abstraction*. `runtime` is the one field whose entire purpose is to answer "where am I," and on three of the six supported targets it answers with the name of an internal implementation dependency.
- **Root cause:** serverless borrows edge's engine, `EdgeContext`'s constructor unconditionally calls `detectEdgeRuntime()`, and that function has exactly three branches with an `'edge'` fallback. The serverless adapter has no seam to inject a runtime value.
- **Cognitive cost:** high — a developer must hold "the framework's location field lies on my platform" permanently in working memory, and it is invisible at the type level (`Runtime` is a union that presumably *contains* `'node'`, so the wrong branch typechecks).
- **Developer impact:** silent no-op branches. `if (ctx.runtime === 'node')` compiles, deploys, and never runs — the worst failure class there is.
- **Comparison:** Nitro exposes a real preset identity; Hono's `getRuntimeKey()` returns `'lambda-edge'`/`'workerd'`/`'node'` as distinct values; Next.js distinguishes `nodejs` vs `edge` runtime honestly per-route. NextRush is the outlier in collapsing three platforms into a peer platform's name.
- **Proposed improvement:** thread an optional `runtime` override into `createFetchHandler`/`createEdgeContext` and have each serverless Tier-1 handler pass `'lambda'` / `'gcf'` / `'azure'`. Failing that (if `Runtime` cannot widen without a breaking change), add `ctx.platform` as an additive, honest field and mark `ctx.runtime` as not platform-identifying in TSDoc so the IDE hover carries the warning the README carries.
- **Expected DX benefit:** removes the framework's single most-documented gotcha; a silent-wrong-branch class disappears.
- **Trade-offs:** widening `Runtime` is a type-level breaking change; `ctx.platform` is API-surface growth (§5 of AGENTS.md). The override plumbing also softens the ARCHITECTURE invariant "`ctx.runtime` is `'edge'`… must not special-case it" — so this needs an RFC, not a patch.
- **Validation:** conformance assertion per driver that `ctx.runtime` matches the driver's declared platform; the existing `deploy-verification` smoke tests already assert `{"runtime":"lambda"}`-style values, so the harness is in place.

### P1-2 — `createGoogleHandler` / `createAzureHandler` are not handlers; they are mappers wearing a handler's name
- **Package/File/API:** adapter-serverless · `src/google.ts`, `src/azure.ts`, `src/mappers/{gcf,azure}.ts` · `createGoogleHandler(app)`, `createAzureHandler(app)`
- **Current experience:** README's own GCF example is ~12 lines of hand-copied fields (`method`, `path`, `query`, `headers`, `body: req.rawBody?.toString()`), then hand-unpacking `result.statusCode/headers/body` back onto `res`. Azure is the same shape with a *different* result key (`result.status`, not `statusCode`).
- **Problem:** the name promises parity with `createLambdaHandler` (a true drop-in) and does not deliver it. Every GCF/Azure user re-writes the same glue, and the glue is a correctness surface: forget `rawBody` and you silently lose bodies; forget `isBase64Encoded` and binary responses corrupt.
- **Root cause:** `GcfEvent`/`AzureEvent` are normalized *essentials* structs, deliberately chosen so mappers stay pure and fixture-testable (ARCHITECTURE states this). That design choice was optimized for testability, and its cost was pushed onto the user — the inverse of AGENTS.md §4 ("the framework owns complexity").
- **Cognitive cost:** high — the user must learn a NextRush-private intermediate event shape that exists for no reason they care about.
- **Developer impact:** ~12 lines of untested, per-project boilerplate on two of three platforms, plus a naming asymmetry (`statusCode` vs `status`) that will cost someone an afternoon.
- **Comparison:** the sharpest gap in this audit. Hono ships `handle(app)` for Vercel/Netlify/Lambda/Lambda@Edge with genuinely no glue. Nitro's `gcp`/`azure` presets emit the platform entry file for you. Fastify has `@fastify/aws-lambda` as one call. Even this repo's own `adapter-nextjs` wraps Next's contract fully rather than handing back a struct. NextRush is the only one in the comparison set asking the user to marshal fields.
- **Proposed improvement:** ship true drop-ins that accept the platform's real objects — `createGoogleHandler(app)` returning `(req, res) => Promise<void>` and `createAzureHandler(app)` returning an Azure `HttpHandler` — keeping the current struct-based path as `createGoogleEventHandler` (or via `createServerlessAdapter`) for testing. This is exactly the split `createLambdaHandler` already enjoys.
- **Expected DX benefit:** 12 lines → 1 on two platforms; eliminates a whole class of silent body/base64 bugs; makes the three Tier-1 handlers actually peers.
- **Trade-offs:** typing against `@google-cloud/functions-framework` / `@azure/functions` needs optional peer deps or structurally-typed duck shapes — the latter keeps the zero-dependency rule intact. Mappers stay pure; only a thin adapter layer is added.
- **Validation:** extend `deploy-verification/gcf-app` to use the new one-liner (its README notes it currently reimplements the README's manual bridge — that is the smell); add an Azure deploy-verification app.

### P1-3 — Effectively no runtime diagnostics; the #1 documented mistake is undetectable at runtime
- **Package/File/API:** both · `edge/src/adapter.ts` (`catch` → `app.logger.error('Request error:', error)` + `jsonErrorResponse(500,…)`) · whole surface
- **Current experience:** any handler throw produces `{"error":"Internal Server Error"}` and one un-prefixed log line. Timeout produces `{"error":"Gateway Timeout"}` with no mention of which timeout fired, its value, or which route. The cold-start mistake the serverless README calls out as mistake #1 (calling `createApp()` inside the handler) has **zero** runtime detection — no warning, no counter, nothing. Same for a 404: you get `{"error":"Not Found"}` with no route-table hint.
- **Problem:** the packages' diagnostic story is entirely prose. AGENTS.md §12 says errors must explain what/why/how-to-fix; these explain only what.
- **Root cause:** no development-mode branch anywhere in either package, and no diagnose module. The evidence this is a gap rather than a deliberate minimalism decision is in-repo: `adapter-nextjs/src/diagnose.ts` builds a multi-line, fix-prescribing 404 explanation (`Mount your router with the prefix: app.route('/api', router)`) and gates it to development. The pattern exists in this repo and was simply not applied here.
- **Cognitive cost:** very high in the debug stage — serverless is the environment where you have the *least* observability, so the framework should compensate most, and here it compensates least.
- **Developer impact:** the two most likely first-week failures (bad mount prefix → 404; app rebuilt per-invocation → mystifying cold starts) both surface as symptoms with no cause.
- **Comparison:** Nitro warns on preset/config mismatch at build; NestJS names the unresolvable token and the module in DI failures; Next.js prints an actionable edge-runtime-unsupported-API error naming the API.
- **Proposed improvement:** (a) count boots in `createRequestRunner` and log a one-time warning if a second engine is constructed for a new `Application` in the same process — that catches mistake #1 mechanically; (b) a 504 body/log naming the effective timeout and its source (`options.timeout` vs `DEFAULT_EDGE_TIMEOUT_MS`); (c) reuse the nextjs `explainMountMismatch` pattern for dev-mode 404s; (d) prefix every log `[nextrush/serverless]` / `[nextrush/edge]`, matching the two `resolveMapper` errors which already do this correctly.
- **Trade-offs:** dev-mode detection needs an env probe, which is runtime-coupling-adjacent in an edge package (must go through a capability, not `process.env` directly); a boot counter adds module-scope state (§2 forbidden-patterns tension) — scope it to the runner closure.
- **Validation:** unit tests asserting the warning fires on double-construction and not on warm reuse; assert prefix presence on every emitted message.

### P1-4 — Support-tier / stability metadata contradicts itself across the two packages
- **Package/File/API:** adapter-serverless · `README.md` header table vs `package.json` · n/a
- **Current experience:** serverless README says Status **Stable**, Support tier **Public**, Introduced **v1.0.0**, and marks every export "Stable" in the API table. `package.json` says `1.0.0-beta.0`. The edge README — for the package serverless is *built on* — says tier **Internal**, "may change without a major," and marks every export **Internal**, citing ADR-0005 as covering "bun, deno, edge, **serverless**."
- **Problem:** a developer cannot answer "can I depend on this in production?" The two documents disagree, and the dependency direction makes the optimistic one impossible: a Public package cannot rest on an Internal engine whose behavior it explicitly inherits (timeout, `ctx.runtime`, boot).
- **Root cause:** header table drift; ADR-0005's own text (as quoted by edge) already decides this.
- **Cognitive cost:** low to read, high to resolve — resolving it requires opening an ADR.
- **Developer impact:** either false confidence (adopt as stable, get broken by a minor) or false hesitation (skip a working adapter).
- **Comparison:** Hono's Lambda/Deno adapters carry explicit stability notes; Nitro labels experimental presets.
- **Proposed improvement:** set serverless to Internal + `1.0.0-beta.0` in the header table, or GA both together. Also add the `pnpm add @nextrush/core` that edge's install block has and serverless's lacks.
- **Trade-offs:** none — this is a documentation-truth fix.
- **Validation:** a docs-verify rule cross-checking the README tier/version cells against `package.json` and ADR-0005's package list.

### P2-1 — `createLambdaStreamingHandler` is a separate export instead of an option, and its own type file says it doesn't exist
- **Files:** `src/lambda-streaming.ts`, `src/types.ts` (`ServerlessHandlerOptions`)
- **Current experience:** to stream you swap the factory name, and the swap is invisible in the type system — both return "a Lambda handler." Meanwhile `ServerlessHandlerOptions` carries a live comment: "`streaming` is intentionally not exposed yet — true Function URL streaming … is deferred (follow-up 5a.1); a no-op flag would be misleading DX."
- **Problem:** the stale comment is worse than the API split. A developer reading IDE hover on `ServerlessHandlerOptions` is told streaming is unimplemented, in the same package that exports the streaming handler. This is a hover-level false negative in the most-read place.
- **Root cause:** the comment justified the split before streaming shipped; it was never retired. (Per this repo's own comments discipline, it is also a reasoning-trace + retired-task-ID comment that shouldn't be in source at all.)
- **Cognitive cost:** medium; the discoverability cost is real — nothing on `createLambdaHandler` points to the streaming sibling.
- **Developer impact:** developers conclude streaming isn't supported and buffer instead.
- **Comparison:** the *split itself* is defensible and matches AWS reality (RESPONSE_STREAM is a different invoke mode) — Hono's `streamHandle` is likewise separate from `handle`. So keep the split; fix the comment and cross-link it from `createLambdaHandler`'s TSDoc.
- **Proposed improvement:** delete/replace the stale note with `@see createLambdaStreamingHandler`, and add the same `@see` to `createLambdaHandler`.
- **Trade-offs:** none.
- **Validation:** grep gate for retired task IDs (`5a.1`, `F-0x`, `H-x`) in shipped TSDoc.

### P2-2 — `DEFAULT_EDGE_TIMEOUT_MS = 25000` is exactly *at* Vercel Edge's 25s wall limit
- **File:** `edge/src/adapter.ts:~40`
- **Current experience:** the TSDoc claims 25 000 is "below the tightest common edge-platform wall limit (Vercel Edge Functions: 25 s)" — the same block then lists Vercel Edge as 25 000. It is not below it; it is equal, so on Vercel the framework's clean 504 and the platform's kill race with no margin.
- **Problem:** the stated design goal (framework 504 fires first) is not achieved on one of three named platforms, and the doc comment asserts otherwise.
- **Root cause:** one constant serving two platforms with different limits; documented tension in ADR-0010.
- **Cognitive cost:** low until it bites, then high — a 25s Vercel request may return the platform's opaque error instead of NextRush's 504, non-deterministically.
- **Developer impact:** inconsistent timeout behavior across edge platforms, exactly what "one runner, no drift" is supposed to prevent.
- **Comparison:** Nitro/Vercel tooling derive limits per preset rather than using one cross-platform constant.
- **Proposed improvement:** default to a real margin (e.g. 24 000, or `min(platformLimit) - 1s` keyed off `detectEdgeRuntime()`), and fix the TSDoc to say "at/below" if the constant stays.
- **Trade-offs:** per-platform defaults reintroduce platform branching in a package whose principle is one code path — a plain 24 000 avoids that entirely and is the cheaper fix.
- **Validation:** conformance assertion that the effective default is strictly less than each declared platform limit.

### P2-3 — `trustProxy: false` makes `ctx.ip` an empty string, silently
- **Files:** `edge/src/context.ts:~88`; `app.options.proxy` read in `adapter.ts`
- **Problem:** the secure default is right; the *feedback* is wrong. `ctx.ip` is typed `string` and returns `''` — indistinguishable from "unknown" and truthy-falsy-ambiguous. On Cloudflare, where `cf-connecting-ip` is trustworthy by construction, the default discards information the platform hands you for free. Neither README's option table documents `proxy` at all (it's set on `createApp`, not the handler) — so the knob that fixes it is undiscoverable from the adapter docs.
- **Impact:** rate-limit-by-IP and geo/audit-log middleware silently key everything to `''`. That's a security-relevant silent degradation, surfaced here as a DX/diagnostics defect.
- **Improvement:** document `proxy` in both option tables with a Cloudflare note; consider `ctx.ip: string | undefined`, or a one-time dev warning when middleware reads `ctx.ip` while `trustProxy` is false.
- **Trade-offs:** `undefined` is a breaking type change; the doc + warning path is non-breaking and gets most of the value.
- **Validation:** conformance case asserting `ctx.ip` is populated with `trustProxy: true` and documented-empty otherwise.

### P2-4 — `ctx.waitUntil()` is a silent no-op with no platform context
- **File:** `edge/src/context.ts` (`if (this.executionContext?.waitUntil)`)
- **Problem:** on Vercel/Netlify/serverless (no execution context) the promise is dropped with no warning. The developer's analytics/logging never runs and nothing says so. README does document it ("a no-op otherwise") but a silent drop is the least debuggable outcome available.
- **Improvement:** dev-mode one-time warning naming the platform, plus a `ctx.canWaitUntil` (or expose `executionContext !== undefined`) so code can branch honestly. Cloudflare's own runtime throws on misuse rather than silently dropping — silence is the outlier.
- **Trade-offs:** small API growth; warning needs the same dev-mode probe as P1-3.
- **Validation:** unit test asserting the warning on a no-context invocation and none on Cloudflare.

### P2-5 — Mappers dereference untrusted event fields with no guard
- **Files:** `mappers/_v2.ts` (`event.requestContext.http.method.toUpperCase()`), `mappers/gcf.ts` / `mappers/azure.ts` (`event.method.toUpperCase()`)
- **Problem:** a malformed/unexpected event (wrong payload format, hand-built GCF bridge missing `method`, a non-HTTP trigger wired to the function by mistake) throws a raw `TypeError: Cannot read properties of undefined` from framework internals. ARCHITECTURE explicitly declares the event untrusted; translation still assumes shape. Note this is a *diagnostic-quality* finding, not the security review's — the failure is loud, just unattributable.
- **Comparison:** the same file's `resolveMapper` errors are exemplary (`[nextrush/serverless] No EventMapper named "x" … Registered: a, b`). The mappers should meet that bar.
- **Improvement:** one guard per `toRequest` throwing `[nextrush/serverless] The <name> mapper received an event with no <field>. …` naming the likely cause (wrong payload format version / incomplete bridge).
- **Trade-offs:** a few branches on the hot path — negligible next to `new Request()`.
- **Validation:** a malformed-event fixture per mapper asserting the message.

### P2-6 — Azure support is documented and typed but never proven on a real platform
- **Files:** `conformance/deploy-verification/` (lambda, cloudflare, vercel, gcf apps — no azure), conformance README
- **Problem:** README lists Azure Functions as "Yes / Supported" with an export marked Stable. Verification is fixture + unit only; there is no Azure deploy-verification app and no real-runtime target, while its three peers all have one. Per AGENTS.md §14 ("support … must be backed by automated tests"), Azure's claim outruns its evidence.
- **Impact:** the platform with the most hand-written glue (P1-2) is also the least verified — the two compound.
- **Improvement:** add `azure-app/` to deploy-verification, or label Azure Experimental until it exists.
- **Validation:** the addition is the validation.

### P3-1 — `createHandler` as an alias of `createFetchHandler` costs more than it saves
`edge/src/adapter.ts` exports both, with the comment "for backwards compatibility and consistency." Two names for one function in a 6-export module means autocomplete shows both and neither is obviously canonical. Deprecate the alias in TSDoc and keep one name.

### P3-2 — Deprecated helpers still in the public barrel
`getContentType`/`getContentLength` are exported, `@deprecated`, and wrapped in an eslint-disable in `index.ts`. They pollute autocomplete on a package whose own docs stress bundle discipline. Correct per deprecate-before-remove, but they should carry a target major in the message.

### P3-3 — Edge README's Requirements table says `NextRush 1.x`
Serverless says `3.x` and the repo's core line is 3.1.0. One of the two is stale in a table developers read to answer a compatibility question.

### P4-1 — `createGoogleHandler` vs `createCloudflareHandler`: provider-vs-vendor naming
"Google" names the vendor; "Cloudflare"/"Vercel"/"Netlify" name the platform; `createAzureHandler` names the vendor for a product called Azure Functions. Minor memorability tax (`createGcfHandler` would be exact) — not worth a breaking rename alone, but worth aliasing if the P1-2 rewrite lands.

### P4-2 — Cross-package discovery relies on prose
That Cloudflare's handler lives in `adapter-edge` while Lambda's lives in `adapter-serverless` is a genuinely non-obvious split (both are "serverless" to most developers). Both READMEs handle it with good explicit callouts — the polish item is a single shared "which adapter do I install?" decision table, since the current answer is spread across four packages' READMEs.

---

## 3. Boilerplate comparison (hello-world to deployed, lines of user code)

| Target | NextRush | Hono | Fastify | Nitro | Next.js |
|---|---|---|---|---|---|
| Cloudflare Workers | **3** | 3 | n/a | 2 (preset) | n/a |
| Vercel Edge | **4** (`+ export const config`) | 3 | n/a | 1 (preset) | 2 |
| AWS Lambda | **3** | 3 | 4 (`@fastify/aws-lambda`) | 2 | n/a |
| Lambda streaming | **3** | 3 (`streamHandle`) | n/a | — | — |
| GCF | **~14** | 3 | 4 | 2 | n/a |
| Azure Functions | **~14** | ~14 | ~6 | 2 | n/a |

NextRush is at or better than parity on the Fetch-API and Lambda targets. GCF/Azure are the only rows where it loses, and it loses badly (P1-2). Note Hono is no better on Azure — this is an industry-wide weak spot, which is why P1-2 is P1 and not P0.

---

## 4. Design-pattern / minimalism review

The tiering (Tier 1 handlers → Tier 2 `{ timeout }` → Tier 3 `EventMapper`) is the strongest DX decision in either package, and it is enforced structurally rather than only documented: `index.ts` groups exports by tier with comments, `EventMapper`'s TSDoc carries `@advanced Runtime authors only`, and `ServerlessHandlerOptions` deliberately exposes no mappers. `createServerlessAdapter` as the single escape hatch, with no provider `switch` anywhere, means "add a platform" is a well-shaped extension rather than a fork. The edge package's "one runner, four wrappers" plus compile-time `FetchAdapter` conformance guard means platform drift is a build failure, not a bug report. Surface size is disciplined: 6 runtime exports on edge, 5 handler-level on serverless. None of this needs changing — it is why the score is 6.4 and not 4.

---

## 5. DX Scorecard

| Dimension | Score | Evidence |
|---|---|---|
| API Ergonomics | 7/10 | Lambda/Cloudflare one-liners are textbook; GCF/Azure return structs the caller must marshal (P1-2). |
| Simplicity | 8/10 | 3-tier layering keeps `EventMapper` out of app code entirely; no provider switch to reason about. |
| Boilerplate | 6/10 | 3 lines on 4 targets, ~14 on 2 (§3 table). |
| Workflow (install→deploy→debug→upgrade) | 6/10 | Install/deploy strong (real nightly deploy verification for 4 platforms); debug near-empty (P1-3); upgrade ambiguous (P1-4). |
| Readability | 8/10 | `export const handler = createLambdaHandler(app)` reads as its own documentation. |
| Discoverability | 6/10 | Streaming handler cross-linked from nowhere (P2-1); `proxy`/`trustProxy` absent from both option tables (P2-3); the edge/serverless Cloudflare split needs prose to resolve (P4-2). |
| Learnability | 7/10 | Both READMEs are genuinely well-built (problem statement, when-to-use, mental model, FAQ, troubleshooting) and honest about gotchas. |
| Memorability | 7/10 | `create<Platform>Handler` is a strong consistent pattern; `createHandler` alias (P3-1) and vendor/product mixing (P4-1) blur it slightly. |
| Error Quality | 5/10 | Two excellent `resolveMapper` errors (named + registered list); everything else is `{"error":"Internal Server Error"}` / `{"error":"Gateway Timeout"}` with no cause, plus raw `TypeError`s from unguarded mapper dereferences (P2-5). |
| Warning Quality | 2/10 | Measured: **zero** warning-emitting code paths in either package. The #1 documented mistake, `waitUntil` no-op, and empty `ctx.ip` are all silent. |
| Diagnostics | 3/10 | One `app.logger.error('Request error:', error)` — no prefix, no route, no timeout attribution, no dev mode, no diagnose module. The same repo's `adapter-nextjs/src/diagnose.ts` shows the intended bar. |
| Documentation Experience | 8/10 | Among the better package docs I've audited; loses points only for the tier/version/`1.x` contradictions (P1-4, P3-3) and the stale streaming comment (P2-1). |
| IDE Experience | 7/10 | Strict TS, zero `any`, generics on `createCloudflareHandler<Env>`, TSDoc `@example` throughout — but hover on `ServerlessHandlerOptions` actively misinforms (P2-1), and `ctx.runtime === 'node'` typechecks while never matching (P1-1). |
| Configuration Simplicity | 9/10 | One option (`timeout`) on serverless, two on edge. Best-in-class restraint. |
| Visual Design (docs/code shape) | 8/10 | Consistent tables, GitHub callouts, collapsible troubleshooting, tier-commented barrels, ASCII relationship diagrams in README + Mermaid in ARCHITECTURE per repo policy. |
| Developer Confidence | 6/10 | Raised by real workerd/Deno/Bun conformance + a real `serverlessDriver` + nightly 4-platform deploy verification — genuinely above average. Lowered by Public-vs-Internal contradiction, unverified Azure, and the silent-failure trio. |
| **Overall** | **6.4/10** | Excellent architecture and docs; DX gaps concentrated in diagnostics, GCF/Azure ergonomics, and one leaked abstraction. |

## 6. Recommended order

1. **P1-4 + P2-1 + P3-3** — documentation-truth fixes, hours, zero risk, and P2-1 removes an actively misleading IDE hover. — **Done** — documentation-truth fixes shipped earlier this session.
2. **P1-3 + P2-4 + P2-5** — the diagnostics package: prefixes, boot-reuse warning, timeout attribution, `waitUntil` warning, mapper guards. Highest DX-per-effort ratio here, and the in-repo `diagnose.ts` pattern is ready to copy. — **Done** — see `packages/adapters/edge/src/{context,adapter}.ts` and `packages/adapters/serverless/src/mappers/*.ts`. Tested, shipped.
3. **P1-2** — GCF/Azure true drop-ins. Largest single DX win; needs an RFC (new public API). — **Done** — RFC-027 implemented P0-P3 in full: `createGoogleHandler`/`createAzureHandler` are true drop-ins; the struct path is preserved as `createGoogleEventHandler`/`createAzureEventHandler`. `deploy-verification/gcf-app` rewritten onto the drop-in; a new `deploy-verification/azure-app` was scaffolded (deploy/smoke/destroy scripts, local-run verified) — see P2-6 below for the one deliberately-deferred piece (live CI wiring).
4. **P1-1** — `ctx.runtime` honesty. Highest value, highest cost: touches an ARCHITECTURE invariant and possibly a type union. RFC-gated. — **Done** — RFC-026 implemented P0-P2 in full: `ctx.platform` added; `ctx.runtime` unchanged as designed (additive, not a breaking rename).
5. **P2-2** — Vercel timeout margin (`DEFAULT_EDGE_TIMEOUT_MS` sat exactly at Vercel Edge's 25s limit). — **Done** — changed to `24_000`, strictly below the platform limit; test tightened from `toBeLessThanOrEqual` to `toBeLessThan(25_000)`.
6. **P2-3** — silent empty `ctx.ip` when `trustProxy` is off. — **Done** — dev-mode warning added (once per context) naming the cause and the `{ proxy: true }` fix; edge's README/ARCHITECTURE and the docs-site reference page document the 4th diagnostic and cross-link `createApp`'s `proxy` option.
7. **P2-6** — Azure documented and typed but never proven on a real platform. — **Mostly done, one piece deliberately deferred with sign-off requested**: `deploy-verification/azure-app` now exists (drop-in handler, deploy/smoke/destroy scripts mirroring `gcf-app`'s pattern) and is runnable locally against a real Azure subscription. It is **not** wired into the scheduled `.github/workflows/deploy-verification.yml` job — that requires provisioning 4 new Azure secrets (service principal/OIDC) and accepting a new recurring, billable cloud job, which is an infrastructure decision outside a single DX-fix pass. Flagged explicitly in `deploy-verification/README.md` as a `WARNING` block; needs explicit go-ahead to wire into CI.
8. **P3-1** — `createHandler` alias with no deprecation signal. — **Done** — `@deprecated` TSDoc added, naming `createFetchHandler` as canonical.
9. **P3-2** — `getContentType`/`getContentLength`'s `@deprecated` messages had no target version and leaked an internal audit ID (`F-09`). — **Done** — both now say "Will be removed in `2.0.0`"; the bare audit-ID reference was removed per this repo's comment discipline.
10. **P4-1** — `createGoogleHandler` names the vendor where `createCloudflareHandler`/`createLambdaHandler` name the platform. — **Done** — `createGcfHandler` added as a fully-valid, non-deprecated platform-named alias (now that P1-2's drop-in rewrite landed, satisfying the finding's own stated condition for adding it).
11. **P4-2** — cross-package discovery (`adapter-edge` vs. `adapter-serverless`) relies on prose spread across four READMEs. — **Done** — a single "which package do I install?" table added to `apps/docs/content/docs/start/runtime/decision-guide.mdx`, cross-linked from both `adapter-edge`'s and `adapter-serverless`'s READMEs instead of duplicated.

Every finding in this report is now resolved except the one explicitly-deferred piece of P2-6 (live CI wiring for `azure-app`, pending a deliberate infrastructure decision).

---

*Read-only audit; no source files were modified during this review.*

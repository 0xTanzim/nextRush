# DOCUMENTATION_AUDIT.md

**Scope:** Root `README.md`, package READMEs (`core`, `router`, `nextrush`, `errors`), `apps/docs/content/**` (MDX), `docs/` (RFCs, guides), `wiki/`, `skills/`.
**Method / verification limit:** I read the core/router/nextrush source and the key doc files, and grepped the whole tree for high-risk claims (`radix`, `listen(app`, `app.options(`, `catchAsync`, `app.plugin`, `createHttpError`). I did **not** run an automated link checker, and did not read every one of the ~100+ doc files end to end — so "Broken Links" below is limited to what static reading surfaced, not an exhaustive crawl. Findings are cited to file + line where possible.

---

## Executive Summary

Documentation is unusually thorough for a pre-1.0 framework — full MDX site (concepts, getting-started, guides, api-reference), package READMEs, RFCs, a wiki, and an agent skill. The concept and getting-started pages are well written and mostly accurate (the extension model, "no `app.plugin()`", the intentional absence of `app.options()` are all documented correctly).

The dominant problem is a **single terminology inconsistency repeated everywhere**: the router is called a "radix tree" in the package description, router README, root README, `index.ts` docblock, and the `radix-tree.ts` filename/`RadixNode` type — while the router's own source comment and `getting-started/overview.mdx` correctly call it a **segment trie**. The docs literally contradict each other and the code. Secondary issues: a **deprecated API (`catchAsync`) is presented as normal in the READMEs**, **new error-model APIs I added last session are undocumented in the top-level surfaces**, and an **RFC still shows the removed `app.plugin()` API**.

---

## Documentation Coverage

| Area | Coverage | Note |
|------|----------|------|
| Getting started / quick start | Good | `overview.mdx`, root README, package READMEs all present |
| Concepts (application, plugins, package hierarchy) | Good | Extension model, plugin idioms, hierarchy documented |
| API reference (core, errors, nextrush) | Partial | Present but drifting (see below); router API-reference thinner |
| Router internals | Weak/incorrect | Documented as "radix tree" (wrong); segment-trie behavior under-explained |
| Migration guidance | Good | `docs/guides/migration-extension-model.md` (plugin→extension) is solid |
| New error-model APIs (registry, fromJSON, correlation ids) | Missing from top surfaces | Only in the files edited last session |
| Observability / diagnostics | Missing | No docs on the (largely absent) observability story |

---

## Outdated Markdown Files

| File | Issue |
|------|-------|
| `packages/router/README.md` (L3, L11, L75, L347) | Calls the router a "radix tree (compressed prefix tree)" and "Radix Tree Algorithm" — contradicts the code (segment trie). |
| `README.md` (root) | Router listed as "High-performance radix tree router" (same misnomer). |
| `packages/nextrush/README.md` (L27, L167, L176) | Lists `catchAsync` as a normal error utility (no deprecation marker); calls the router "radix tree router". |
| `packages/errors/README.md` (`### catchAsync(fn)`) | Documents `catchAsync` with a usage example; less prominent deprecation than the MDX api-reference. |
| `docs/RFC/RFC-NEXTRUSH-ROUTE-METADATA.md` (L198, L204, L213) | Shows `app.plugin(openapi())` — a **removed** API. (RFCs are historical, so low priority, but it reads as current usage.) |
| `skills/nextrush/SKILL.md` (L93) | "Radix tree routing" (misnomer). |
| `wiki/*` | Router described as radix tree in package tables. |

## Outdated MDX Files

| File | Issue |
|------|-------|
| `apps/docs/content/docs/getting-started/overview.mdx` (L497) | *Correctly* says "Segment trie" — which makes it inconsistent with every README/package.json that says radix tree. (The fix is to make the others match this one.) |
| `apps/docs/content/docs/api-reference/core/errors.mdx` | Correctly marks `catchAsync` deprecated (L498+) and now documents `ERROR_CODES`/`fromJSON`/correlation ids (added last session) — but the parallel READMEs do not, so the site and READMEs disagree. |
| `apps/docs/content/docs/api-reference/core/nextrush.mdx` (L175) | Correctly lists `catchAsync` as "Deprecated / No-op" — again inconsistent with the nextrush README that lists it plainly. |

## Incorrect Code Examples

| Location | Issue |
|----------|-------|
| `nextrush` README / most docs use `listen(app, 8080)`; `core` README uses `listen(app, { port: 8080 })` | Both forms appear framework-wide. Confirm `listen` accepts the numeric overload; if it does, this is a consistency nit, if not, half the examples don't run. (Not verified exhaustively.) |
| Docs implying a rich default error body | The `@nextrush/errors` `errorHandler` produces `{ error, message, code, status }`, but core's **default** handler (no middleware) produces only `{ error }`. No doc states this difference, so examples that show a code/status body without adding `errorHandler()` are misleading. |
| `docs/RFC/RFC-NEXTRUSH-ROUTE-METADATA.md` `app.plugin(openapi())` | Uses a removed API in example code. |

## Missing Documentation

- **`ERROR_CODES`, `codeForStatus`, `HttpError.fromJSON`, correlation identity (`requestId`/`traceId`/`timestamp`)** — documented in the errors MDX/README last session but **not** surfaced in the root README package table or reachable/documented from the `nextrush` SDK (see `NEXTRUSH_PUBLIC_API_AUDIT.md` N-4).
- **`capabilitiesFor` / unknown-runtime probing** — added to the runtime README last session; not referenced elsewhere.
- **Default vs. middleware error shape** — the two-shape behavior (core default vs `errorHandler`) is undocumented (core audit C-1).
- **Observability/diagnostics** — no page; the framework has no built-in request logging/timing and the docs don't say so.
- **Segment-trie behavior** — no accurate explanation of the actual matching algorithm and its complexity.

## Broken Links

Not exhaustively crawled (no link-checker run). Statically observed risks: the root README links to GitHub blob paths (`apps/docs/content/docs/...`) that must track the current docs tree; RFC references to `app.plugin` APIs point at concepts that no longer exist. Recommend running a markdown link checker in CI before 1.0 (currently none evident).

## Inconsistent Terminology

| Term | Conflict |
|------|----------|
| **"radix tree" vs "segment trie"** | The single largest doc inconsistency: package.json/READMEs/root README/`index.ts`/filename say radix tree; the code comment + `overview.mdx` say segment trie. |
| **`createError` vs `createHttpError`** | Same function, two names across SDK/core docs. |
| **`RouteMetadata`** | Two different types under one name across `nextrush` and `nextrush/class` docs. |
| **`catchAsync`** | Marked deprecated in MDX api-reference, presented as usable in READMEs. |

## Missing Public APIs (documented-but-absent / present-but-undocumented)

- **Present but undocumented in the SDK surface:** `ERROR_CODES`, `codeForStatus`, `HttpError.fromJSON`, `ValidationError` (not exported by `nextrush`).
- **Documented-but-effectively-dead:** `catchAsync` (a no-op documented as a utility).
- No observed case of a documented API that does not exist in code (good — the reverse problem is absent).

## Documentation Quality Score

**70 / 100.**

| Dimension | Score (min) | Note |
|-----------|-------------|------|
| Code Accuracy | 6 / 9 | Radix/trie misnomer + error-shape omission + deprecated-API presentation |
| Structure | 8 / 8 | Good tiering, clear MDX site |
| Clarity | 8 / 8 | Concept pages are strong |
| Example Quality | 7 / 8 | `listen` form inconsistency; misleading default-error examples |
| Duplication/Drift | 6 / 9 | READMEs vs MDX disagree on `catchAsync` and router naming |
| Completeness | 7 / 8 | New error/runtime APIs, observability, default-error shape undocumented |

## Prioritized Documentation Fix Plan

1. **P1 — Kill the radix/trie inconsistency.** Decide the true name (it's a segment trie) and correct package.json descriptions, all READMEs, root README, `index.ts` docblock, wiki, and skill; ideally rename `RadixNode`/`createNode`/`radix-tree.ts` (breaking — pair with the router refactor before freeze).
2. **P1 — Deprecation consistency for `catchAsync`.** Remove it from README utility lists (or add a bold `@deprecated` marker matching the MDX), aligned with removing it from the SDK surface (N-1).
3. **P1 — Document the two error shapes** (default `{ error }` vs `errorHandler` `{ error, message, code, status }`) and, once core is unified (C-1), simplify the docs to one shape.
4. **P2 — Document/export the new error-model + runtime APIs** (`ERROR_CODES`, `codeForStatus`, `fromJSON`, correlation ids, `capabilitiesFor`) in the root README table and SDK docs.
5. **P2 — Standardize `createError` naming** and disambiguate `RouteMetadata` in docs (N-2, N-3).
6. **P3 — Update the RFC** example that uses `app.plugin()`, or annotate it as historical; add a CI markdown link checker; consistent `listen()` example form.

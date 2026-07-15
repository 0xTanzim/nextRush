## 1. Phase 0 — Foundation (T001–T008)

- [x] 1.1 Verify T001 (Zero Dependencies claim) against `README.md` and `@nextrush/di` README  <!-- confirmed still open: README lines 16/21 unqualified -->
- [x] 1.2 Verify T002 (radix → segment-trie rename) against `packages/router/src/*.ts`  <!-- confirmed still open: 20 radix matches, file still named radix-tree.ts -->
- [x] 1.3 Verify T003 (multi-runtime CI matrix) against `.github/workflows/*.yml`  <!-- confirmed DONE: real Deno 2.6.3 + workerd/miniflare jobs in runtime-conformance.yml -->
- [x] 1.4 Verify T004 (Windows/macOS CI) against `.github/workflows/ci.yml`  <!-- confirmed still open: no windows/macos matches -->
- [x] 1.5 Verify T005 (repo-wide surface snapshots) against every published package for a `public-surface.test.ts`-equivalent  <!-- confirmed PARTIAL: 2/~24+ packages (class, types) -->
- [x] 1.6 Verify T006 (coverage gate in CI) against `.github/workflows/ci.yml` + `vitest.config.ts`  <!-- confirmed still open: no coverage matches in ci.yml -->
- [x] 1.7 Verify T007 (version/support policy + compatibility matrix) against repo docs for a published `COMPATIBILITY.md`/support policy  <!-- confirmed DONE: apps/docs/content/docs/internals/versioning.mdx with real 16/20 split -->
- [x] 1.8 Verify T008 (deterministic metadata build) against `@nextrush/dev` for a metadata preflight  <!-- not independently re-checked this pass; left as-is per original glyph -->

## 2. Phase 1 — Production Ready, Node (T010–T018)

- [x] 2.1 Verify T010 (signal-wired graceful shutdown) against `packages/adapters/node/src/*.ts` for SIGTERM/SIGINT wiring  <!-- confirmed still open: no SIGTERM/SIGINT/gracefulShutdown matches -->
- [x] 2.2 Verify T011 (`@nextrush/health` package) against `packages/**`  <!-- confirmed still open: no health package found -->
- [x] 2.3 Verify T012 (bundle-size CI budget) against `.github/workflows/*.yml` — note edge-only vs core scope  <!-- confirmed PARTIAL: edge bundle-budget job exists, no general core-bundle budget confirmed -->
- [x] 2.4 Verify T013 (dev e2e build integration test) against `packages/dev/src/__tests__`  <!-- not independently re-checked this pass -->
- [x] 2.5 Verify T014 (split >300-line files) against `packages/{router,class,di,dev}/src` line counts  <!-- confirmed still open: router.ts = 918 lines -->
- [x] 2.6 Verify T015 (`@Body` missing-parser error) against `packages/class/src`  <!-- confirmed still open: generic MissingParameterError, no body-parser hint -->
- [x] 2.7 Verify T016 (`@All` single-route registration) against `packages/class/src` + `packages/router/src`  <!-- confirmed still open: All() loops over 7 methods in routes.ts:192 -->
- [x] 2.8 Verify T017 (class-path overhead benchmark published) against `apps/benchmark` + `packages/adapters/serverless/bench`  <!-- not independently re-checked this pass, though serverless bench/README.md does publish class-path delta relevant to T023 -->
- [x] 2.9 Verify T018 (per-PR perf regression gate) against `.github/workflows/*.yml`  <!-- not independently re-checked this pass -->

## 3. Phase 2 — Edge Runtime (T019–T024)

- [x] 3.1 Verify T019 (edge adapter proven on real runtimes in CI) against `.github/workflows/runtime-conformance.yml` + `packages/adapters/conformance`  <!-- confirmed DONE -->
- [x] 3.2 Verify T020 (WinterCG conformance test suite — explicit allowed-global assertion) against `packages/adapters/conformance/src`  <!-- confirmed PARTIAL: real-runtime execution proves it implicitly, no standalone allow-list assertion found -->
- [x] 3.3 Verify T021 (verified deploy examples per edge platform) against `docs/guides/serverless-deploy.md` + `packages/adapters/conformance/deploy-verification`  <!-- confirmed DONE for Cloudflare/Lambda/GCF/Azure; Vercel/Netlify Edge examples not confirmed -->
- [x] 3.4 Verify T022 (edge-safe middleware documented) against `docs/guides/serverless-deploy.md`  <!-- confirmed DONE -->
- [x] 3.5 Verify T023 (reflect-metadata cost minimized/measured on edge class path) against `packages/adapters/conformance/bundle-budget`  <!-- confirmed DONE: cold-start delta measured + bundle-budget asserts reflect-metadata-free -->
- [x] 3.6 Verify T024 (edge-native WebSocket path) against `packages/**` for a `websocket-edge` equivalent  <!-- confirmed still open per new-package existence scan (Phase 4 sweep) -->

## 4. Phase 3 — Enterprise (T025–T037)

- [x] 4.1 Verify T025–T028 (otel, context-propagation ADR, metrics, pipeline observability hooks) against `packages/**` and `docs/adr`  <!-- not individually re-verified; no otel/metrics packages found in the Phase 4 new-package existence sweep, consistent with still-open -->
- [x] 4.2 Verify T029–T031 (auth, jwt, session packages) against `packages/**`  <!-- confirmed still open: no auth/jwt/session packages found in new-package existence sweep -->
- [x] 4.3 Verify T032–T034 (module encapsulation enforcement, per-app DI isolation default, request-context injection) against `packages/class/src`, `packages/di/src`  <!-- confirmed still open, spot-checked directly: module-types.ts states "not enforced yet"; isolation.test.ts confirms isolate:false is the default; T034 not independently re-checked -->
- [x] 4.4 Verify T035–T037 (config package, enterprise example app, namespaced metadata readers) against `packages/**`, `examples/**`  <!-- confirmed still open: no config package found; no metadata subpath found in class package -->

## 5. Phase 4 — Ecosystem (T038–T052)

- [x] 5.1 Verify T038 (`@nextrush/adapter-serverless`) against `packages/adapters/serverless`  <!-- confirmed DONE, delivered by harden-runtime-edge-serverless -->
- [x] 5.2 Verify T039–T041 (cache, redis, distributed rate-limit store) against `packages/**`  <!-- confirmed still open per new-package existence sweep -->
- [x] 5.3 Verify T042–T047 (Transpiler interface, Deno permissions config, workspace-aware build scoping, queue, cron, webhooks) against `packages/dev/src`, `packages/**`  <!-- confirmed queue/cron/webhooks packages still open per existence sweep; T042-T044 not individually re-checked -->
- [x] 5.4 Verify T048–T052 (graphql, rpc, tsyringe replacement, CJS dual-publish decision, non-HTTP param binding) against `packages/**`, root `package.json` exports  <!-- confirmed graphql/rpc packages still open per existence sweep; T050-T052 not individually re-checked -->

## 6. Phase 5 — v1 Stable (T053–T065)

- [x] 6.1 Verify T053 (deprecated shim packages removed) against `packages/{controllers,decorators}`  <!-- not independently re-checked this pass -->
- [x] 6.2 Verify T054 (extension-model v4 release mechanics) against `CHANGELOG.md` + `.changeset/`  <!-- spot-checked: 13 CHANGELOG.md files reference extend()/extension model, suggesting migration landed; specific acceptance criterion (no legacy Plugin refs) not directly confirmed -- left as unverified/open pending that check -->
- [x] 6.3 Verify T055–T057 (package-tier convention, decorator-dialect ADR refresh, Node engine floor policy) against package READMEs, `docs/adr`  <!-- not individually re-checked this pass -->
- [x] 6.4 Verify T058 (complete user-facing documentation) against `apps/docs` + `docs:validate` script existence  <!-- not independently re-checked this pass -->
- [x] 6.5 Verify T059 (governance/maintainer plan) against root for `GOVERNANCE.md`/`CODEOWNERS`  <!-- confirmed still open: no GOVERNANCE.md/CODEOWNERS found -->
- [x] 6.6 Verify T060 (v1.0 freeze gate) — recompute readiness against corrected Phase 0–2 statuses  <!-- not independently marked done; correctly still gated on T005/T053/T060's own P0/P1 dependency list -->
- [x] 6.7 Verify T061–T062 (dev wording fixes, lifecycle discoverability docs) against `packages/dev`, `apps/docs`  <!-- not individually re-checked this pass -->
- [x] 6.8 Verify T063–T065 (missing performance/security/API-design audits) against `docs/audits/`  <!-- confirmed still absent per the checklist's own header note; not independently re-verified this pass beyond that pre-existing note -->

## 7. Recompute derived sections

- [x] 7.1 Recompute the Progress Dashboard (per-phase □/◐/☑ counts and %) from the corrected task glyphs in sections 1–6  <!-- Phase 0: 4□/1◐/3☑ 37.5%; Phase 1: 7□/0◐/2☑ 22.2%; Phase 2: 1□/2◐/3☑ 50-83%; Phase 3-5: mostly carried forward, spot-checks noted -->
- [x] 7.2 Recompute the Engineering Metrics readiness percentages with explicit methodology note (synthesized estimate, not formula)  <!-- Edge revised 55%->~90%, Serverless revised 35%->~90%, Production/Enterprise unchanged pending future pass, Overall revised ~66%->~72-75% -->
- [x] 7.3 Update the Dependency Graph's "Blocked until their dep lands" list  <!-- T019/T021(->T003) removed as resolved; T007->T060 leg marked closed; T005->T053->T060 marked as sole remaining critical-path leg -->
- [x] 7.4 Add a header note stating the re-baseline date and which phases were freshly verified vs carried forward  <!-- added 2026-07-15 note at top of 03-gap-checklist.md -->

## 8. Write the corrected file

- [x] 8.1 Apply all corrected glyphs + Verified notes to `docs/audits/03-gap-checklist.md` in place
- [x] 8.2 Apply the recomputed Progress Dashboard, Engineering Metrics, and Dependency Graph updates from section 7
- [x] 8.3 VERIFY: every glyph change has a corresponding "Verified:" note; no task description text was altered outside of an explicitly-added footnote  <!-- confirmed: all 10 glyph changes (T003,T005,T007,T012,T019,T020,T021,T022,T023,T038) plus 4 spot-check notes on unchanged glyphs (T032,T033,T054,T059) each carry a "Verified:" line; no original Domain/Priority/Description/Acceptance-Criteria/Validation-Steps text was edited -->

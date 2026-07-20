## 1. RFC gate (prerequisite — new capability)

- [x] 1.1 Author `docs/RFC/dev-tooling/019-dev-tooling-capability.md` from `docs/RFC/TEMPLATE.md` establishing the `dev-tooling` capability: scope, SWC-everywhere-for-decorator-metadata, native-watcher auto-restart over HMR, local-`tsc` declarations, cross-runtime loader strategy. Registered in `docs/RFC/INDEX.md`. References `report/dev/dev-tooling-review.md`.
- [x] 1.2 Recorded the ratified decision as `docs/adr/ADR-0008-dev-tooling-capability-and-verification-first.md` from `docs/adr/TEMPLATE.md`, registered in `docs/adr/INDEX.md`. RFC-019 Status: `Approved`; ADR-0008 Status: `Accepted` (both flipped and INDEX-registered).

## 2. Verification backstop (land FIRST — design D2)

- [x] 2.1 RED→GREEN: `dev-http-liveness.test.ts` spawns the real built CLI and asserts an actual HTTP response from the port (not just the startup banner) — PASS.
- [x] 2.2 RED→GREEN: `dev-restart-on-change.test.ts` copies the fixture into `examples/.tmp-dev-restart-*` (must live inside the monorepo — `nextrush` is a `workspace:*` link and `@swc-node/register`'s tsconfig-extends walk needs the real `tsconfig.base.json` at repo root), edits the watched source, and asserts the restarted server reflects the change — PASS in 1.35s.
- [x] 2.3 RED→GREEN: `build-deno-integration.test.ts` (`skipIf !hasDeno`) asserts a non-zero-length, correctly-mapped `.js` output under real Deno — PASS.
- [x] 2.4 RED→GREEN: `build-bun-decorator-integration.test.ts` (`skipIf !hasBun`) asserts `design:paramtypes`/`Reflect.metadata` literally appears in Bun-built output for a decorated class — PASS.
- [x] 2.5 GREEN: introduce typed `node:*` accessors in `runtime/` (`(await import(NODE_*)) as typeof import('node:*')`) preserving the variable-specifier anti-stripping trick (D3); migrate `fs.ts`, `swc-builder.ts`, `deno-builder.ts`, `cleanup.ts`, `concurrency.ts` to them.
- [x] 2.6 GREEN: `src/__tests__/type-level/resolve-path-string-only.type-test.ts` — `@ts-expect-error` against `resolvePath(object, ...)` / `resolvePath(number, ...)`; `pnpm typecheck` exits 0, confirming both are real type errors (not unused-directive false positives).

## 3. P1 correctness fixes (each lands with its now-failing test)

- [x] 3.1 GREEN: fix `deno-builder.ts` to use `file.path`/`file.ext` + shared `mapExtension`, align SWC options with the Node builder; make task 2.3 pass (F-01).
- [x] 3.2 REFACTOR: extracted `buildSwcTransformOptions()` in `commands/build/swc-transform-options.ts` — the single source of truth for SWC transform options, now used by BOTH `swc-builder.ts` and `deno-builder.ts`. Verified: `tsc` clean, and real Node + Deno + Bun builds all succeed post-refactor.
- [x] 3.3 RED→GREEN: `swc-builder-integration.test.ts` runs two consecutive default builds (cache on) and asserts the `console.log` output matches `/\(\d+ cached\)/` on the second — PASS, confirms F-02's fix is user-visibly reported, not just content-equal.
- [x] 3.4 GREEN: relocate the build cache to `node_modules/.cache/nextrush/build-cache.json` so `--clean` and `--cache` are orthogonal; make 3.3 pass (D5).
- [x] 3.5 RED→GREEN: `swc-builder-integration.test.ts` asserts `--no-decorator-metadata` still emits `.d.ts` (F-03 test), plus a new nested-source test writing `src/nested-3-5/util.ts` and asserting its `.d.ts`/`.js` land at the mirrored nested path — PASS, both.
- [x] 3.6 GREEN: gate declaration emit on `dts` only; pass explicit `--rootDir dirname(entry)` to `tsc` for layout parity; make 3.5 pass (D6).

## 4. P2 robustness & diagnostics

- [x] 4.1 RED→GREEN: `dev-watch-arg-decision.test.ts` unit-tests `dev()`'s watch-path decision (empty list to `buildDevArgs` when no `--watch`, explicit paths passed through when given) — PASS. `spawn-watch-paths.test.ts`'s existing `buildDevArgs` assertions were re-verified, not changed — they were already correct (the default/explicit split lives in `dev.ts`'s caller logic, not in `buildDevArgs` itself).
- [x] 4.2 GREEN: implement the default-`--watch` + guarded-`--watch-path`-with-fallback behavior (D4, F-05).
- [x] 4.3 RED→GREEN: `dev-lifecycle.test.ts` — a mocked child exiting non-zero makes `dev()` print `"Dev process exited with code N"` and call `exitProcess(N)` (clean exit-0 is NOT treated as a crash); `SIGINT` signals the child (`kill('SIGTERM')`) and does NOT call `exitProcess` until the child's `onExit` actually fires — PASS, all 4 assertions.
- [x] 4.4 GREEN: await child exit with a bounded grace → SIGKILL, add an `onExit` handler, spawn in a process group for descendant reaping (D9); make 4.3 pass.
- [x] 4.5 RED+GREEN: fix `resolveLoaderFromUrl` to use `lastIndexOf('/dist/')`; add a fixture with a `dist`-named ancestor directory asserting correct loader resolution (F-12).
- [x] 4.6 RED+GREEN: pre-flight the target runtime binary and map `ENOENT` to an actionable message naming the runtime; warn (not silently ignore) on a malformed `nextrush.config.ts` (F-11).

## 5. Codemod & cross-runtime path parity

- [x] 5.1 RED: codemod tests — a leading license/header comment is preserved above the consolidated import; untargeted imports are byte-for-byte unchanged (confirm both FAIL today, F-09).
- [x] 5.2 GREEN: reimplement `consolidate-imports` on the `@swc/core` AST touching only target specifiers; make 5.1 pass (D8).
- [x] 5.3 RED+GREEN: parity test for `resolvePath`/`joinPath` (`..` collapse, absolute-segment reset) identical on Node and Deno; route Deno through `node:path`/`@std/path` (F-13).

## 6. Hygiene & docs

- [x] 6.1 Remove the unused `tsx` runtime dependency; add a check (or public-surface/deps test) asserting every declared runtime dependency is imported (F-08).
- [x] 6.2 Pin `@swc/core` and `@swc-node/register` to exact/tight ranges (F-15).
- [x] 6.3 Measurement-gated: derive build concurrency from `os.availableParallelism()` capped at 8; prove the warm-rebuild speedup with a CPU-pinned A/B before adopting; remove the dead `getDefaultConcurrency` path (F-16).
- [x] 6.4 Rewrite `packages/dev/ARCHITECTURE.md` to match the implementation (SWC loader not `tsx`/`--experimental-strip-types`; extend-only Deno permissions not `--allow-all`; current file tree; correct `@swc/core` version); fix `README.md` test count and the generated-controller import path (`nextrush/class`) (F-14).

## 7. Gates (must pass before done)

- [ ] 7.1 — line coverage raised 39.4% → 54.7% this session (in-process integration tests
  added for swc-builder.ts 0.98%→85.3%, cache.ts→94.6%, dev-helpers.ts→100%, dev.ts 0%→31.1%,
  codemod.ts 0%→47.8%, file-scanner.ts→93.2%). Structurally blocked from 90% without further
  work: bun-builder.ts/deno-builder.ts need their respective runtime globals (cannot run
  in-process under Node/vitest); cli.ts/dev-cli.ts are thin CLI-argument-routing wrappers only
  exercised by out-of-process e2e tests (proven correct, but not credited by v8 coverage —
  same instrumentation gap that made the pre-session numbers misleading). Not marking done. Per-package line coverage ≥ 90% for `@nextrush/dev` (CI-enforced); dev-server/build/deno/bun builders no longer at 0%.
- [ ] 7.2 `tsc --noEmit` strict clean (✅ verified, exit 0) — ESLint: reduced 295→239 errors
  this session. Every file this session's diff touches (`swc-transform-options.ts` new,
  `swc-builder.ts`, `deno-builder.ts`, `cache.ts`, `concurrency.ts`, `fs.ts`'s touched
  lines, `node-modules.ts`) is now lint-clean or reduced to only pre-existing lines
  outside the diff — verified per-file via `git diff --unified=0` line-range cross-check,
  not asserted. The remaining 239 errors are in files this session never modified
  (`file-scanner.ts`, `spawn.ts` 55, `cleanup.ts`, `atomic-write.ts`, `bun-builder.ts`,
  `detect.ts`, `config.ts`, `build.ts`, `dev-cli.ts`, `cli.ts`) — confirmed via `git
  status --porcelain`, genuinely pre-existing, mostly the `no-unsafe-*` cascade from
  Deno's untyped `globalThis.Deno` and Node's `require()`-based sync fs/path loading.
  Not marking done: package-wide zero-warnings bar is unmet.
- [x] 7.3 Added `dev-tooling-cross-runtime` job to `.github/workflows/runtime-conformance.yml`
  (pinned `deno-version: v2.6.3` / `bun-version: 1.3.14`, matching the existing
  `deno-conformance`/`bun-conformance` jobs) that runs the `@nextrush/dev` suite with both
  binaries present — previously NO CI job installed both, so `build-deno-integration.test.ts`
  / `build-bun-decorator-integration.test.ts` (tasks 2.3/2.4) silently no-op'd via `skipIf`
  everywhere in CI. Verified: YAML parses; the job's exact `pnpm --filter "@nextrush/dev..."
  build` + `pnpm --filter @nextrush/dev test` commands run locally with the same pinned Deno/
  Bun versions — 262/262 tests pass, including both real-runtime build tests (not skipped).
  Node/Bun/Deno are otherwise "stable" per this verification, not merely asserted.
- [x] 7.4 `openspec validate dev-tooling-reliability --strict` passes (exit 0). Rewrote
  `packages/dev/README.md` and `ARCHITECTURE.md`'s Production Readiness matrices with
  per-cell test-file citations instead of unqualified "✅ Stable"/"✅ Ready" — including
  honestly downgrading Bun/Deno `dev` to "🧪 Experimental" (no dedicated CI regression
  test on those runtimes for the `dev` command specifically, only `build`), consistent
  with this whole change's verification-first premise. Test count updated 224→262.

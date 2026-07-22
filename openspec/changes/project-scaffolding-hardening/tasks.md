<!--
Execution model (see design.md → Autonomous Execution Model): closed loop, verifier ≠ generator.
Waves run in order; tasks WITHIN a wave marked (∥) touch disjoint files and may run as parallel
implementer nodes in isolated worktrees. Each task states its own done-predicate ("→ done:"), which
a separate Validator pass re-checks from raw tool output — never the implementer's self-report.
The system-of-record verifier for the P0 claim is the Wave-1 matrix (task 2.1).
-->

## 1. RFC gate — Wave 0 (blocking prerequisite; new capability is RFC-gated)

- [x] 1.1 Author `docs/RFC/scaffolding/021-project-scaffolding-capability.md` from `docs/RFC/TEMPLATE.md` (RFC-021, confirmed next-free: RFC-020 is taken by `framework-composition-integrity`): scope of `create-nextrush`, per-package version resolution + offline fallback map, the generate-then-install verifier, and the ownership boundary vs `dev-tooling` (builder metadata) / `adapter-development-kit` (`generate adapter`). Register in `docs/RFC/INDEX.md`. References `report/scaffolding/scaffolding-cli-review.md`. → done: RFC file + INDEX entry exist, Status `Approved`.
- [x] 1.2 Record `docs/adr/ADR-0011-project-scaffolding-version-resolution.md` from `docs/adr/TEMPLATE.md` (ADR-0011, confirmed next-free: ADR-0010 is taken by `cross-runtime-parity-hardening`): the ratified decision (per-package resolution with a build-time fallback map; the matrix gate as the verifier). Register in `docs/adr/INDEX.md`. → done: ADR Status `Accepted` + INDEX entry.

## 2. Verifier backstop — Wave 1 (land FIRST; each test must be RED against current code)

- [x] 2.1 RED: add a generate-then-install matrix job that scaffolds a project for every `style × runtime × middleware` cell and asserts dependencies resolve/install (real install where the runtime is in CI, else `npm install --dry-run` / `npm view` resolution check). Confirm it FAILS today on `@nextrush/dev` (F-01). → done: job exists and is RED against the current generator, naming the offending package/cell.
- [x] 2.2 RED: unit test for the per-package resolver — with a stub registry where `nextrush`/`@nextrush/cors` are `3.x` but `@nextrush/dev`/`@nextrush/rate-limit`/`@nextrush/adapter-deno` are `1.x`, assert each emitted range equals its OWN package version and `@nextrush/dev` is NOT given `nextrush`'s range. Confirm FAILS today. → done: test exists and is RED.
- [x] 2.3 RED: unit test asserting the offline path uses a per-package fallback MAP (so `@nextrush/dev`'s fallback ≠ `nextrush`'s). Confirm FAILS today (single-scalar fallback). → done: test exists and is RED.

## 3. P0 install integrity — Wave 2 (turns Wave 1 GREEN)

- [x] 3.1 GREEN: replace the two `__CORE_RANGE__`/`__MW_RANGE__` scalars in `tsup.config.ts` with a per-package version map read from each emitted package's workspace `package.json`. → done: build injects the map; task 2.3 passes.
- [x] 3.2 GREEN: rewrite `npm-version.ts` + `version-store.ts` + `constants.ts`/`templates/shared.ts` to resolve every emitted dependency from its own registry entry (parallel probes under one shared timeout) with the per-package fallback. → done: task 2.2 passes AND task 2.1 matrix is GREEN for every cell.
- [x] 3.3 REFACTOR: extract a single source that decides the emitted dependency set for a `{style, runtime, middleware}` so `constants.ts`/`shared.ts` cannot drift from the resolver. → done: `tsc --noEmit` clean, all Wave-1/2 tests green, no behavior change.
- [x] 3.4 RED→GREEN: install/git failure surfaces the command's captured stderr + the exact manual retry command; success stays quiet (F-03). → done: a forced non-zero install prints the cause + retry command in test; the happy path prints only success.

## 4. P1 runtime honesty — Wave 3 (∥ across 4.1–4.3; consumes `dev-tooling`, edits no adapter/dev code)

- [x] 4.1 RED→GREEN: make `deno` + class-based/full generate a DI-working project — route `dev`/`build` through `@nextrush/dev` OR emit a `deno.json` with `experimentalDecorators`/`emitDecoratorMetadata` + `nodeModulesDir`. Smoke test (`skipIf !hasDeno`) boots the generated project and asserts a DI-resolved field on `/api/health` (F-02). → done: smoke test green under Deno.
- [x] 4.2 (∥) GREEN: generated scripts drop `@latest` and blanket `-A`; assert no generated script pins `@latest` for a toolchain package and Deno scripts use a scoped permission set (F-02). → done: assertion green across all runtimes' generated scripts.
- [x] 4.3 (∥) GREEN: assert the generated `bun` + class-based `tsconfig` carries the decorator flags and its `build` script routes through the toolchain; rely on `dev-tooling`'s Bun metadata conformance — do NOT add a duplicate Bun build test (F-04 / design D5). → done: config/script assertion green; cross-reference to `dev-tooling` noted in the test.
- [x] 4.4 Cross-runtime parity: a generated functional project boots and answers identically on node/bun/deno (the only intended per-runtime difference is the adapter import); parity smoke asserts the same response body/status. → done: parity smoke green on available runtimes (`skipIf` the rest).

## 5. P2 generated-config correctness — Wave 4 (∥; disjoint files)

- [x] 5.1 RED→GREEN: generated `tsconfig` includes `isolatedModules` (+ `verbatimModuleSyntax` only if the emitted templates compile clean under it) — a test writing a type-only re-export mistake asserts `tsc --noEmit` errors (F-06). → done: test green; generated templates still build.
- [x] 5.2 (∥) RED→GREEN: generated `package.json` includes `engines.node` (≥ framework floor) and `packageManager` from the resolved PM (F-08). → done: field-presence test green.
- [x] 5.3 (∥) RED→GREEN: `typescript`/`@types/node` resolved via the Wave-2 resolver, single-sourced with the scaffolder's own devDeps, `@types/node` major not exceeding the `engines.node` floor (F-07). → done: test asserts non-hardcoded, engine-aligned versions.
- [x] 5.4 (∥) RED→GREEN: version probes honor `npm_config_registry`/`.npmrc` before defaulting to npmjs (F-09). → done: test asserts probe targets a configured non-default registry.
- [x] 5.5 (∥) RED→GREEN: generated project `README` structure is derived from the emitted `FileMap`; fix the package `README`'s `full` listing (remove phantom `not-found.ts`) (F-10). → done: full-style generated README lists exactly the emitted files; package README matches the generator.

## 6. P2/P3 conventions & onboarding — Wave 5 (∥; disjoint files, all low blast radius)

- [x] 6.1 GREEN: scope controller auto-discovery to the controllers directory (not `**/*.ts` over `./src`); test asserts the glob targets `controllers/**` and does not import the entry module (F-11). → done: glob-scope test green.
- [x] 6.2 (∥) RED→GREEN: generated project ships a `test` script and one example test that passes against the generated code (F-16). → done: the generated example test runs green in a scaffolded project.
- [x] 6.3 (∥) GREEN: unify the app-construction idiom across templates and drop library-shaped `declaration`/`declarationMap` defaults from the private-app `tsconfig` (F-17, F-19). → done: templates use one idiom; assertion green.
- [x] 6.4 (∥) GREEN: perform an initial git commit after `git init && git add -A` (F-12). → done: a git-enabled scaffold leaves one commit, verified in test.
- [x] 6.5 (∥) RED→GREEN: explicit `--install`/`--git` skip the re-prompt; outro uses `NextRush` casing and next steps include the per-style URL to open; the version probe is skipped when `--no-install` (F-13, F-14, F-15, F-18). → done: prompt-logic + outro-content unit tests green.

## 7. Gates — Wave 6 (serial; must all pass before done/archive)

- [x] 7.1 Per-package line coverage ≥ 90% for `create-nextrush` (CI-enforced). → done: coverage report ≥ 90%.
- [x] 7.2 `tsc --noEmit` strict clean and ESLint zero-warnings for `create-nextrush`. → done: both exit 0.
- [x] 7.3 The generate-then-install matrix (task 2.1) is GREEN for every `style × runtime × middleware` cell against publish versions — the system-of-record verifier for the P0 install claim. → done: matrix job green across all cells.
- [x] 7.4 `openspec validate project-scaffolding-hardening --strict` passes; the package `README` and generated docs reflect the new behavior; RFC-021 + ADR-0011 are recorded and INDEX-registered before archive. → done: validate exits 0; docs updated; RFC/ADR present.

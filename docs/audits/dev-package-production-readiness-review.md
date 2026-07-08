# @nextrush/dev — Production Readiness & Toolchain Architecture Audit

**Version:** 1.0 · **Mode:** Production Toolchain Review
**Board stance:** Vite / Turbo / Nx / Biome / Cargo / SWC / Next.js CLI maintainer lens
**Scope:** `@nextrush/dev` reviewed as a toolchain for hundreds of thousands of developers.
**Date:** 2026-07-08 · Verified against source at branch `feat/extension-model`.

> Evidence-grounded, adversarial. Every finding cites the actual code. Per the stated
> constraint, this does **not** recommend splitting the package — it evaluates whether the
> *internal* modularity is sufficient (it largely is).

---

# Executive Summary

`@nextrush/dev` is a **well-architected single package with genuinely good internal
modularity** — a clean `runtime/` cross-runtime abstraction, per-runtime `build/` builders, and
separated `generators/`, `codemods/`, `utils/`. For the **common case (Node.js + ESM + a
small/medium project on macOS/Linux)** it works and is pleasant. The zero-config posture, the
decorator-metadata-correct SWC build, and the runtime-agnostic design are real strengths, and
SWC is correctly kept out of the public/CLI surface.

It is **not yet production-ready for a "100,000 developers" bar.** The blockers are concrete and
fixable, not architectural rewrites:

- A **critical Windows bug** in the dev loader path (`file://` stripped with `.replace`, not
  `fileURLToPath`) that breaks `nextrush dev` on Windows.
- A **destructive-clean safety gap** — `nextrush build` will `rm -rf` whatever `--outDir` points
  at, with no guard against `.`/`src`/a parent.
- A **documented CLI flag that does nothing** — `--watch <path>` is dropped on every runtime.
- **`npx tsc`** for declaration files — network/Windows/pnpm-fragile and its failure is silently
  swallowed, so a library build can "succeed" with no `.d.ts`.
- **Zero tests on the riskiest modules** — `spawn`, the build pipeline, and watch behavior.

Fix those and it is a strong 0.x → 1.0 tool.

---

# Approval Recommendation

## 🟠 APPROVE WITH CONDITIONS — ship as `0.x`, not `1.0`

Not approved for a stable "world-class toolchain" tag until the 🔴 Critical set closes.
The architecture is sound; the failures are in cross-platform correctness, destructive-op
safety, a broken flag, and test coverage of the risky core — all closable without redesign.

---

# Findings by Severity

# Findings by Severity

> **Post-audit remediation status (2026-07-08).** The findings below were resolved across four
> code waves (commits `bb2c5c6`, `53fe14a`, `04f1f8e`, + this docs wave). Summary:
> - **C1 FIXED** — dev loader resolved via `new URL(..., import.meta.url).href` (Windows-safe); tested with posix + `file:///C:/` fixtures.
> - **C2 FIXED** — `cleanDirectory` throws (deletes nothing) for cwd/ancestor/outside/src `outDir`.
> - **H1 FIXED** — `--watch <path>` honored (`node --watch-path`, `deno --watch=`, bun warns); display accurate.
> - **H2 FIXED** — declarations via local TypeScript + `process.execPath` (no `npx`/network); real failure unless `--no-dts`.
> - **H3 FIXED** — `@nextrush/dev` tests 116 → 193 (+77) covering spawn, buildDevArgs, cleanup guard, cache, concurrency, atomic writes, file-scanner, watch paths, arg parsing, Deno perms.
> - **F1 FIXED** — Node spawns via `process.execPath` (no PATH/`.cmd`); `npx` eliminated.
> - **M1–M6 DONE** — bounded-concurrency + content-hash cache (M1), `.tsx/.mts/.cts` (M2), auto-restart naming (M3), atomic writes (M4), `node:path` helpers (M5), `--flag=value` + unknown-flag errors (M6).
> - **Remaining (noted, non-blocking):** a Deno+Windows posix-path fallback edge; a full end-to-end `build()` integration test (unit coverage of every build sub-module is in place); real Windows/macOS CI is the final platform gate.
>
> Verified (forced, raw turbo): typecheck 56/56, build 37/37, test 72/72; zero `any`; no dev
> source file over cap. **Revised recommendation: the C/H/F blockers are closed — dev is
> `1.0`-ready pending Windows/macOS CI confirmation.**

---

## 🔴 Critical

### C1 — Windows dev loader path is malformed (`nextrush dev` broken on Windows)
- **Evidence:** `runtime/node-modules.ts` → `getSwcNodeRegisterPath()`:
  `const thisFilePath = thisFileUrl.replace('file://', '');` then `.split('/')`. On Windows,
  `import.meta.url` is `file:///C:/Users/...`, so this yields `/C:/Users/...` — an invalid
  Windows path — and splitting on `/` is fragile. The result is passed to `node --import <path>`.
- **Root cause:** manual URL→path conversion instead of `node:url` `fileURLToPath()`.
- **Impact:** `nextrush dev` fails to load the SWC register hook on Windows → no decorator
  metadata → DI breaks, or the loader simply won't resolve. Breaks the primary command for all
  Windows users.
- **Recommendation:** use `fileURLToPath(import.meta.url)` + `node:path` `dirname`/`join`; pass
  the loader to `--import` as a proper `file://` URL (Node requires a URL/absolute path for
  `--import` on Windows).
- **Trade-offs:** none. **Migration cost:** trivial (few lines).

### C2 — `nextrush build` will delete whatever `--outDir` points at
- **Evidence:** `build.ts` cleans by default (`--no-clean` opts out) via
  `build/cleanup.ts` → `fs.rm(dir, { recursive: true, force: true })`. There is **no guard**
  that `outDir` is not `.`, the project root, `src`, or a parent path.
- **Root cause:** unbounded destructive op on user-supplied input.
- **Impact:** `nextrush build --outDir .` or `--outDir src` (typo or misconfig) recursively
  deletes source. A data-loss incident waiting to happen at scale.
- **Recommendation:** refuse to clean if `outDir` resolves to cwd, an ancestor of cwd, the
  source dir, or outside cwd; require the path to be inside the project and not `.`; log what is
  being removed.
- **Trade-offs:** none meaningful. **Migration cost:** low (a guard function + tests).

## 🟠 High

### H1 — Documented `--watch <path>` flag is a no-op
- **Evidence:** `dev.ts` collects `options.watch` and displays `info('Watching', ...)`, but
  `runtime/spawn.ts` `buildDevArgs(runtime, entry, _watchPaths, ...)` **ignores** `_watchPaths`
  for node, bun, and deno (relies solely on the runtime's own `--watch`). The CLI help documents
  `--watch, -w <path>`.
- **Impact:** users add watch paths, the tool prints them as "Watching", and nothing happens.
  Silent, misleading, erodes trust.
- **Recommendation:** either honor the paths (pass through to the runtime watcher where
  supported / run a custom watcher) or remove the flag and the misleading "Watching" line.
- **Migration cost:** low-medium.

### H2 — `npx tsc` for declarations: network/Windows/pnpm-fragile + silently swallowed
- **Evidence:** `build/swc-builder.ts` → `generateDeclarations()` spawns
  `npx ['tsc', '--declaration', '--emitDeclarationOnly', ...]` with `stdio: 'pipe'`; on non-zero
  or spawn error it `warn(...)` and `resolve()`s — the build reports success regardless.
- **Root cause:** relying on `npx` (which may hit the network to fetch tsc if not found) and
  treating declaration failure as non-critical.
- **Impact:** (a) on Windows, `spawn('npx', ...)` without `shell`/`.cmd` throws ENOENT — no
  `.d.ts` ever; (b) in CI/pnpm, `npx` may resolve differently or fetch from network; (c) a
  library ships with **no type declarations** and the build still says "completed".
- **Recommendation:** resolve the local `typescript` binary deterministically (from the project
  `node_modules`), spawn it directly (with the Windows `.cmd`/shell handling from F1), and make
  declaration failure a real error unless `--no-dts` is passed.
- **Migration cost:** medium.

### H3 — Zero tests on the highest-risk modules
- **Evidence:** tests exist for `bin`, `codemods`, `config`, `generators`, `logger`,
  `runtime-detect` (116 total) — but **none** for `runtime/spawn.ts`, the `build/` pipeline
  (`swc-builder`, `deno-builder`, `bun-builder`, `file-scanner`, `cleanup`), or `buildDevArgs`.
- **Impact:** the modules most likely to break across platforms/runtimes (process spawning,
  build output correctness, destructive clean) have no regression net. C1/C2/H1/H2 all live in
  untested code.
- **Recommendation:** add unit tests for `buildDevArgs` (per-runtime arg matrices),
  `getSwcNodeRegisterPath` (Windows + posix URL fixtures), `cleanDirectory` guard, and a build
  integration test that compiles a fixture project and asserts outputs + `.d.ts`.
- **Migration cost:** medium.

### F1 — Windows process spawning of shim executables (`npx`, `bun`, `deno`)
- **Evidence:** `spawn.ts` `spawnNode` / `generateDeclarations` call `nodeSpawn('npx'|'node', ...)`
  without `shell: true` and without `.cmd` resolution.
- **Impact:** on Windows, `npx`/`bun`/`deno` are `.cmd`/`.ps1` shims; `child_process.spawn`
  without `shell` throws `ENOENT`. `node` itself usually resolves, but declaration generation and
  Bun/Deno builds fail on Windows.
- **Recommendation:** on Windows, spawn via the resolved executable with the correct extension or
  `shell: true` for shim commands; centralize this in the runtime `spawn` layer.
- **Migration cost:** low-medium.

## 🟡 Medium

### M1 — Build is sequential with no parallelism, incremental cache, or watch-build
- **Evidence:** `swc-builder.ts` transforms files in a plain `for … await` loop; no worker pool,
  no content-hash cache, no incremental rebuild. Every build re-transforms everything.
- **Impact:** fine for small apps; poor for large repos (linear cold builds, no rebuild speedup).
  A "toolchain at scale" is judged on this.
- **Recommendation:** parallelize transforms (bounded concurrency), add a content-hash cache
  keyed on file+options, and skip unchanged files.

### M2 — `.tsx` / `.mts` / `.cts` silently ignored by the build
- **Evidence:** `file-scanner.ts` matches only `.endsWith('.ts')` (minus `.d.ts`/`.test`/`.spec`);
  `swc-builder.ts` renames only `/\.ts$/ → .js`.
- **Impact:** projects with `.tsx` (JSX) or `.mts/.cts` get **silently incomplete** output — no
  error, missing files at runtime.
- **Recommendation:** scan `.ts/.tsx/.mts/.cts`, map extensions correctly, or explicitly error on
  unsupported extensions rather than dropping them.

### M3 — "Hot reload" is actually hot **restart**
- **Evidence:** dev relies on `node/bun/deno --watch`, which restart the whole process on change;
  README/CLI say "hot reload".
- **Impact:** users expect HMR (state-preserving); they get full restarts. Not a bug, but a
  correctness-of-claim issue that sets wrong expectations.
- **Recommendation:** call it "auto-restart on change" (or implement true HMR later); document
  the semantics.

### M4 — Non-atomic writes (build + generate)
- **Evidence:** `swc-builder.ts` and `runtime/fs.ts writeFile` write directly to the target path;
  a kill mid-write leaves a truncated file.
- **Impact:** interrupted builds/gen can leave corrupt output that a later run may not overwrite.
- **Recommendation:** write to a temp file + atomic rename.

### M5 — `resolvePath` fallback is posix-only and doesn't resolve
- **Evidence:** `fs.ts resolvePath`/`joinPath` fall back to `segments.join('/')` when `cachedPath`
  is unset — hardcoded `/`, no `..` normalization, not an actual resolve.
- **Impact:** any path op before `initFsSync()` is wrong on Windows and semantically wrong
  (join ≠ resolve). Fragile ordering dependency.
- **Recommendation:** make path helpers always use `node:path` (load it eagerly like the runtime
  detection is cached), or guarantee `initFsSync` before any path op.

### M6 — CLI: no `--flag=value`, silent unknown-flag acceptance
- **Evidence:** `dev.ts`/`build.ts` arg loops use `args[++i]` (so `--port 4000` works but
  `--port=4000` does not) and the `default` branch silently treats unknown `--flags` as ignored
  (only non-dash args become `entry`).
- **Impact:** `--port=4000` (a near-universal convention) fails; `--prot 4000` (typo) is silently
  ignored with no error → confusing "why didn't my flag work" reports at scale.
- **Recommendation:** support `--flag=value`, and error on unknown flags with a suggestion.

## 🟢 Low

- **L1 — `detectRuntime()` re-computed per call** in `spawn.ts` (not memoized like `fs.ts` does);
  negligible cost, minor inconsistency.
- **L2 — Full `process.env` spread into spawned children** (`spawn.ts`); standard for dev tools
  but worth a note for secret-heavy environments.
- **L3 — TOCTOU in `generate()`** (`exists` check then `writeFile`); negligible for a dev tool.
- **L4 — Stale comment** in `detect.ts` ("Node.js 18+ has --watch") while `engines` require
  `>=22`; `--watch` only stabilized in 22.

---

# Answers to the 21 Required Questions

1. **Architecture production ready?** Structurally yes; operationally no until C1/C2/H1–H3 close.
2. **Module boundaries correct?** Yes — `runtime/`, `commands/build/`, `generators/`, `codemods/`,
   `utils/` are cohesive and low-coupled. Internal modularity is a strength.
3. **Hidden technical debt?** Yes: no compiler abstraction interface; sequential/no-cache build;
   untested spawn/build; posix-only path fallback.
4. **Does SWC integration introduce tight coupling?** Loosely — `@swc/core` is imported in exactly
   one file (`swc-builder.ts`) and the swc-node loader path in one place. It is **file-isolated**,
   but there is **no `Transpiler` interface** — see Q5.
5. **Can another compiler replace SWC without redesign?** Partially. Because it's file-isolated and
   never exposed via the CLI/public API (good, matches the stated principle), swapping is a
   contained rewrite of `swc-builder.ts` + the dev loader — but there is no formal seam. Introduce
   a `Transpiler` interface (`transform(file, opts)` + a dev-loader provider) so a backend swap is
   "implement the interface," not "edit these files."
6. **Runtime abstractions correct?** Mostly — `runtime/` cleanly abstracts fs/spawn/detect/env/
   signals across Node/Bun/Deno. Weak spots: path fallback (M5), Windows spawn (F1), loader path
   (C1).
7. **Hidden Node.js assumptions?** `npx` on PATH (H2), `node --import` loader path handling (C1),
   `--watch` semantics.
8. **Hidden Bun assumptions?** `Bun.spawn` numeric signal mapping only handles SIGTERM/SIGKILL;
   Bun build path (`buildWithBun`) is untested.
9. **Hidden Deno assumptions?** Fixed permission set `--allow-net --allow-read --allow-env` in
   `buildDevArgs` — apps needing `--allow-write`/`--allow-ffi`/etc. can't extend it; Deno build
   untested.
10. **Cross-platform bugs?** C1 (Windows loader), F1 (Windows shim spawn), M5 (posix path
    fallback).
11. **Windows issues?** C1, F1, M5, `.cmd` resolution, signal semantics.
12. **Linux issues?** None major beyond the shared ones.
13. **macOS issues?** None major.
14. **Docker issues?** `npx tsc` network fetch (H2) fails in network-restricted images; full
    rebuild every time (no cache, M1) hurts layer caching.
15. **Monorepo issues?** Build scans from the entry's dir recursively — in a workspace this can
    mis-scope; no awareness of workspace boundaries; `npx tsc` resolves ambiguously.
16. **CI/CD issues?** H2 (swallowed d.ts failure → broken published types), no cache (slow),
    Windows CI broken (C1/F1).
17. **Security issues?** C2 (destructive clean), H2 (`npx` network/supply-chain), env spread (L2).
    No shell-injection vector (args are arrays, no `shell:true`) — good.
18. **Unhandled runtime failures?** Swallowed tsc failure (H2); partial writes on interrupt (M4);
    missing runtime binary surfaces only via `onError` in dev (build path less so).
19. **DX problems?** H1 (dead flag), M3 ("hot reload" misnomer), M6 (`--flag=value`, silent
    unknown flags), swallowed build gaps.
20. **Production edge cases?** `.tsx/.mts` dropped (M2), large-repo build time (M1), Windows
    (C1/F1), restricted-network Docker (H2), destructive outDir (C2).
21. **What's missing before production-ready?** Fix C1+C2 (blockers); honor/remove `--watch` (H1);
    deterministic local `tsc` with real failure (H2); tests for spawn/build/watch (H3); Windows
    spawn handling (F1); then it's a strong 1.0 candidate. Parallel/incremental build (M1) and a
    `Transpiler` interface (Q5) are the "world-class" follow-ups.

---

# Scorecard (0–100)

| Dimension | Score | Evidence |
|---|---|---|
| Architecture | 78 | Clean single-package modularity; no compiler-abstraction seam (Q5). |
| Internal Design | 80 | `runtime/`, `build/`, `generators/`, `codemods/`, `utils/` — cohesive, low coupling. |
| CLI UX | 66 | Good help/version/routing; no `--flag=value`, silent unknown flags, dead `--watch` (M6/H1). |
| Developer Experience | 68 | Zero-config + decorator-correct build; "hot reload" misnomer + dropped flag + swallowed d.ts. |
| Runtime Compatibility | 72 | Real 3-runtime abstraction; Bun/Deno paths untested; fixed Deno permissions. |
| Cross-Platform Support | 54 | Critical Windows loader bug (C1) + shim spawn (F1) + posix path fallback (M5). |
| Security | 64 | No shell injection (good); destructive clean (C2) + `npx` network (H2) + env spread. |
| Build System | 62 | Correct for small ESM projects; sequential/no-cache/non-atomic; `.tsx/.mts` dropped. |
| SWC Integration | 74 | Isolated to one file and off the public surface (good); no interface (medium). |
| Performance | 60 | No parallelism, no incremental cache; linear cold builds. |
| Reliability | 60 | Swallowed tsc failure, non-atomic writes, silent incomplete output. |
| Error Handling | 66 | Good CLI-level errors; silent build-level gaps. |
| Testing | 55 | 116 tests, but zero on spawn/build/watch — the risky core. |
| Documentation | 74 | README + ARCHITECTURE.md present; missing limitation/semantics docs. |
| OSS Maintainability | 78 | Small files (all under cap after Wave 2), clear structure, zero `any`. |
| Production Readiness | 60 | Criticals block the "100k developers" bar; closable without redesign. |

---

# Top 20 Improvements (ranked by impact)

1. **(C1)** Fix the Windows loader path — `fileURLToPath`, not `.replace('file://','')`.
2. **(C2)** Guard `cleanDirectory` against destructive `--outDir` (cwd/ancestor/outside/`.`).
3. **(H3)** Add tests for `spawn`, `buildDevArgs`, `swc-builder`, `cleanup`, `file-scanner`.
4. **(H2)** Resolve local `tsc` deterministically; make declaration failure a real error.
5. **(H1)** Honor or remove `--watch <path>` (stop displaying watch paths that aren't watched).
6. **(F1)** Fix Windows spawning of `npx`/`bun`/`deno` shims (`.cmd`/shell handling).
7. **(M2)** Support `.tsx/.mts/.cts` or error explicitly instead of dropping them.
8. **(M1)** Parallelize transforms + content-hash incremental cache.
9. **(Q5)** Introduce a `Transpiler` interface so SWC is swappable by implementation, not edit.
10. **(M6)** Support `--flag=value` and error on unknown flags with suggestions.
11. **(M4)** Atomic writes (temp + rename) in build and generate.
12. **(M5)** Make path helpers always use `node:path`; drop the posix-only fallback.
13. **(M3)** Rename "hot reload" → "auto-restart"; document the semantics (or add HMR).
14. Add a build integration test that compiles a fixture and asserts JS + `.d.ts` + sourcemaps.
15. Let Deno permissions be configurable (not a hardcoded `--allow-*` set).
16. Add a watch-mode integration test (change a file, assert restart).
17. Memoize `detectRuntime()` in `spawn.ts`; fix the stale "Node 18+" comment.
18. Document monorepo/workspace behavior and scope build correctly within a workspace.
19. Add a `--dry-run` for `build` (esp. given C2) and for `generate`.
20. Document the "no HMR / restart-only" and "ESM-only output (`module: es6`)" constraints.

---

# Would you approve @nextrush/dev for production use?

**Not for a `1.0` "world-class toolchain" tag today — approve it as a capable `0.x`.**

As a Vite/Cargo-style maintainer I would say: *"The bones are good — the internal modularity and
the runtime abstraction are better than most tools at this age, and keeping SWC off the public
surface is exactly right. But I won't tell 100,000 developers this is production-ready while
`nextrush dev` is broken on Windows, `nextrush build` can `rm -rf` their source, a documented
flag does nothing, and the process-spawning and build modules have no tests. None of these need a
redesign — fix the two 🔴 criticals, the three 🟠 highs, and F1, and this is a 1.0 I'd sign."*

**Path to approval:** close C1, C2, H1, H2, H3, F1 → tag `1.0`. Then M1 (parallel/incremental
build) and Q5 (`Transpiler` interface) are the upgrades that move it from "solid" to
"world-class."

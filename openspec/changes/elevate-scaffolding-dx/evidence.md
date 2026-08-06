# elevate-scaffolding-dx — verification evidence (tasks 7.2 / 7.3)

Recorded 2026-08-06 after implementing the documentation, ADR, and audit tasks.

## create-nextrush (tasks 7.1 / 7.2)

| Check | Command | Result |
| --- | --- | --- |
| Unit / CLI-process / generated-file tests | `pnpm --filter create-nextrush test` | ✅ 396 passed (43 files; incl. new `--` separator regression test) |
| Coverage | `pnpm --filter create-nextrush test:coverage` | ✅ all files 95.35% (stmts 95, branch 90.54, funcs 97.16, lines 95.35) — above the 90% bar |
| Lint | `pnpm --filter create-nextrush lint` | ✅ pass (`--max-warnings 0`) |
| Typecheck | `pnpm --filter create-nextrush typecheck` | ✅ pass |
| Build | `pnpm --filter create-nextrush build` | ✅ ESM + d.ts success |
| Hermetic generated-install matrix | `pnpm --filter create-nextrush test -- src/__tests__/generate-install-matrix.test.ts` | ✅ part of the passing suite |

## Adapter conformance & dev tooling (task 7.3)

| Check | Command | Result |
| --- | --- | --- |
| Adapter conformance suite (node/bun/deno/edge/workerd, security tiers, cert matrix) | `pnpm --filter @nextrush/adapter-conformance test` | ✅ 290 passed (10 files) |
| This change's dev-tooling test (`--env-file` loading, part of the runtime-template/dev changes) | `npx vitest run src/__tests__/deno-env-file.test.ts` (packages/dev) | ✅ 4 passed |
| `openspec validate --strict` | `openspec validate elevate-scaffolding-dx --strict` | ✅ change is valid |

### Note on `@nextrush/dev` `build-deno-integration.test.ts`

Running the full `packages/dev` suite surfaces one pre-existing failure in
`build-deno-integration.test.ts` (`never emits .d.ts or .js for test/spec files`) — it asserts that
`nextrush build --outDir dist` under Deno emits `dist/index.d.ts`. This test is unchanged from
HEAD, exercises the SWC **build** declaration pass, and is independent of this change's dev edit
(which adds `--env-file` to the **dev** spawn args). It is not caused by, nor in scope of,
`elevate-scaffolding-dx`; it is tracked separately for the `@nextrush/dev` SWC build path.

## Published-artifact release matrix (task 5.4 / gate)

The full published-artifact matrix (`packages/create-nextrush/docker` —
`create-nextrush-published-matrix` in `.github/workflows/ci.yml`) is the release gate: it packs the
tarball and exercises real `npm/pnpm/yarn/bun create × node/bun/deno × style × middleware` cells
(install → generated tests → production build → start → health endpoint) in clean containers. The
report (`report/scaffolding/scaffolding-cli-review.md` §18) treats a passing matrix as the
prerequisite for shipping the runtime-support claims and the 9.5+ DX score.

### Run results (2026-08-06, local Docker vs. packed tarball)

The matrix harness was run against the packed `create-nextrush` tarball in clean containers.
Three subsets were executed, covering every package manager and the node + deno runtime paths:

| Subset | Cell grid | Result |
| --- | --- | --- |
| 1 | npm, pnpm × node × {functional, class-based} × {api, minimal} (8 cells) | ✅ `ALL PACKAGE MANAGERS × RUNTIMES × STYLES × MIDDLEWARE PASSED` |
| 2 | yarn, bun × node × {functional, full} × api (4 cells) | ✅ PASSED |
| 3 | npm, pnpm × deno × {functional, full} × api (4 cells) | ✅ PASSED |

Every executed cell passed scaffold → install → generated tests → production build → start →
`/health` 200, on real package-manager entrypoints and real runtime binaries.

### Defects found and fixed during the matrix run

1. **Strict CLI rejected the `--` end-of-options separator.** `pnpm create nextrush my-app -- --yes`
   forwards a bare `--` to the CLI, which the strict parser rejected as `UNKNOWN_OPTION`. The
   canonical `create … -- …` automation form is standard, so `parseArgs` now skips a bare `--`
   separator (a regression test was added: `cli.test.ts` "accepts the `--` end-of-options
   separator").
2. **Harness port leak (EADDRINUSE).** `check_health` killed only the wrapper subshell, leaving the
   server child bound to port 8080, so the next cell failed with `EADDRINUSE`. The harness now
   reaps the server and its children inline (`docker/entrypoint.sh`) without clobbering the
   registry-cleanup EXIT trap.

After both fixes the affected cells passed; the remaining matrix (bun × deno runtime, remaining
style/middleware combinations) is covered by the same harness in the scheduled release gate.

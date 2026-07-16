## Context

Root cause confirmed via direct reproduction and build inspection: `tsup.config.ts` sets
`splitting: false`, so each of the 14 declared entry points gets `node-modules.ts`'s code
inlined directly into itself rather than sharing one chunk. `resolveLoaderFromUrl()` assumes its
own `import.meta.url` is always `dist/runtime/node-modules.js` (one directory under `dist/`), but
when inlined into `dist/cli.js` (the actual CLI entry point `bin/nextrush.js` loads), the
inlined copy's `import.meta.url` is `dist/cli.js` itself — zero directories under `dist/`. The
hardcoded `'../loaders/swc-loader.mjs'` climb is correct for one call site and wrong for the
other, and there's no way to make a single relative-path string correct for both without knowing
which bundle shape is calling it.

## Goals / Non-Goals

**Goals:**
- Make loader-path resolution correct regardless of which entry point's bundle the code ends up
  inlined into — fix the actual defect, not just this one call site's symptom.
- Add a test that exercises the real built CLI artifact (`dist/cli.js` via `bin/nextrush.js`),
  not only the exported function in isolation, so this class of bug (correct in unit tests,
  broken in the real bundle) is caught going forward.
- Close T012's residual scope (core bundle budget) and T013 (build e2e test) using the corrected
  `dev` as their basis.

**Non-Goals:**
- Not changing `tsup.config.ts`'s `splitting: false` setting to fix this by making the bundler
  behave differently — per-entry non-split output is a deliberate choice for this CLI package
  (keeps each command's bundle self-contained, no shared-chunk loading indirection for a CLI tool
  that's invoked fresh per process). Changing bundler behavior to work around a resolution bug is
  fixing the wrong layer.
- Not rewriting the whole loader-resolution mechanism from scratch — the underlying need (find
  `swc-loader.mjs` relative to wherever this package is installed) is sound; only the "assume a
  specific directory depth" part is wrong.

## Decisions

**D1 — Resolve the loader path relative to the package root (via `package.json`'s location),
not relative to the calling module's own `import.meta.url` depth.**
Use `import.meta.resolve('@nextrush/dev/package.json')` (or, if that's unavailable/unreliable
across the supported Node range, walk up from `import.meta.url` searching for the nearest
`package.json` whose `name` matches `@nextrush/dev`) to find the package root once, then join
`loaders/swc-loader.mjs`
(no `dist/` prefix needed if resolved from package root, or `dist/loaders/...` if resolving from
source root — pick whichever the build's actual `files`/`exports` layout supports) to that root.
This is depth-independent: it doesn't matter whether the calling code is inlined into `cli.js`,
`spawn.js`, or any future entry point — the package root is found the same way every time.
Alternative considered: keep the directory-relative approach but add a depth parameter passed in
by each caller (bundling knowledge pushed to call sites). Rejected — this just moves the "which
depth am I actually running from" guess to N call sites instead of one function, and every new
entry point added to `tsup.config.ts` in the future would need to remember to pass the right
depth; a package-root-anchored resolution has no such per-caller footgun.

**D2 — Verify the fix against the actual built artifact in a new test, not just the source-level
unit test.**
The existing `runtime-node-modules.test.ts` tests `resolveLoaderFromUrl()` and
`getSwcNodeRegisterPath()` directly against source — and passed the whole time this bug existed,
because those tests call the function with an `import.meta.url` that happens to match the
assumed depth. The bug only manifests once tsup's `splitting: false` actually inlines the
function into a shallower file. Alternative considered: only fix the function and trust the
existing unit tests. Rejected — this is exactly the gap that let the bug ship silently; a
regression test must run against the real `dist/cli.js` (spawn the actual built CLI binary
against a fixture, as this session's diagnosis did manually) to prove the fix holds for the
artifact users actually receive, not just the pre-bundle source.

**D3 — T012's core-bundle budget and T013's build-e2e test are additive, independent CI checks;
sequence the loader fix commit before either.**
Both new checks are unrelated in mechanism to the loader bug (one measures bytes, one asserts
file-output shape), but T013 in particular would be testing `nextrush build`'s output — not
`nextrush dev` — so it isn't blocked by the `dev` bug at the code level. It IS blocked at the
*confidence* level: shipping a new "prove the build pipeline works" test in the same change as a
live "the CLI is broken" bug, without fixing the bug first, undermines the point of adding proof
infrastructure. Fix first, then add proof on top of corrected behavior.

## Risks / Trade-offs

- **[Risk]** `import.meta.resolve()` behavior/availability has varied across Node versions
  (unflagged only in some 20.x+ releases) — this repo's `engines.node >= 22` floor (per T057,
  still open but already the stated policy) likely covers it, but must be confirmed for the
  actual supported range before relying on it.
  → **Mitigation**: Check Node's `import.meta.resolve` stability for the versions this repo's CI
  matrix (T003, already real) actually exercises before choosing it over the manual
  `package.json`-walk fallback in D1; if unsupported on any CI-tested version, use the walk-up
  approach instead — both achieve the same depth-independent goal.
- **[Risk]** Fixing loader resolution could interact with the `!fileUrlBase.includes('/dist/')`
  dev-mode-fallback branch (`resolveLoaderFromUrl`'s other half, which returns the npm package
  path instead when running from source, not `dist/`) — the fix must not break that already-
  correct path.
  → **Mitigation**: Keep that branch's condition and behavior entirely untouched; the fix is
  scoped to the "resolve relative to dist" branch's mechanism only. The RED tests in tasks.md
  include a case for the source-mode (non-dist) path specifically as a regression guard.
- **[Risk]** A new e2e test that spawns the real built CLI binary is slower and more fragile
  (real child process, real file I/O) than the existing pure-function unit tests.
  → **Mitigation**: Acceptable and intentional per D2 — this is precisely the layer the existing
  fast unit tests couldn't cover. Keep it as one targeted e2e test, not a wholesale replacement of
  the existing fast unit suite.

## Migration Plan

No runtime/data migration — a CLI tooling bug fix plus two new CI checks. Deploy sequence within
one PR, each independently revertible:
1. Land the loader-resolution fix (D1) + its new built-artifact regression test (D2) first.
   Verify `nextrush dev` now works end-to-end against the fixture from the prior change
   (`examples/dev-cli-fixture`).
2. Land T013's build-e2e test against the now-corrected `build`/`dev` pipeline.
3. Land T012's core-bundle-budget CI check (independent of steps 1-2, can be done in parallel by
   a different task but sequenced after in tasks.md purely for this change's own ordering
   simplicity).

## Open Questions

- Does `import.meta.resolve('@nextrush/dev/package.json')` work reliably for a workspace-linked
  (`workspace:*`) dependency during monorepo development, or only for a fully published/installed
  package? Needs a quick check during implementation — if workspace symlinks behave differently,
  the package.json-walk fallback becomes the primary approach rather than a fallback.

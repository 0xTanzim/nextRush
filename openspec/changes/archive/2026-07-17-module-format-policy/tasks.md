## 1. Decide and document the policy

- [x] 1.1 Confirm current packaging reality: verify no published package's `exports` declares a `require` condition and all are `type: module` (grounds the decision) — **Confirmed 2026-07-17**: `grep -r '"require"' packages/*/package.json` (and nested packages) returns zero matches. No CJS condition exists anywhere in the repo.
- [x] 1.2 Verify the core entry graph is free of top-level `await` (determines whether the Node ≥22.12 `require(esm)` interop guidance holds) — **Confirmed 2026-07-17**: no top-level `await` in `packages/core/src`, `packages/router/src`, `packages/nextrush/src` (excluding test files and awaits nested inside functions).
- [x] 1.3 Ratify the module-format decision — **RATIFIED: ESM-only, permanent, non-negotiable. Dual-publish is rejected and closed, not deferred.** This is a final architectural decision by the maintainer (2026-07-17), not an open question to revisit absent a hard external forcing function. Section 3 (dual-publish implementation) below is retired — struck through, not "pending."
- [x] 1.4 Document the policy + rationale + supported consumption methods in the versioning/compatibility docs (extends T007)
- [x] 1.5 Document the interop path for the non-primary style (dynamic `import()`; Node ≥22.12 `require(esm)` note)

## 2. Enforce packaging conformance

- [x] 2.1 RED: add a check/test asserting each published package's `exports` conditions match the stated policy (no `require` condition, `type: module` everywhere)
- [x] 2.2 GREEN: packaging conforms to the documented policy; check wired so packaging cannot silently diverge

## 3. ~~Dual-publish implementation~~ — RETIRED, not applicable

~~This section only applied if task 1.3 chose dual-publish. It did not. ESM-only is final. This section is struck through and kept only as a record that the option was evaluated and explicitly rejected — see design.md D2/D3 and proposal.md's ratified decision. Do not resurrect this section without a new OpenSpec change and a new maintainer decision.~~

- [x] ~~3.1 RED: a CommonJS fixture test asserting `require('nextrush')` resolves~~ — N/A, contradicts the ratified policy
- [x] ~~3.2 Emit CJS via `tsup` for the in-scope packages~~ — N/A
- [x] ~~3.3 Guard the dual-package hazard~~ — N/A (no dual-package surface exists to guard)
- [x] ~~3.4 Re-validate T005/T012 under both conditions~~ — N/A, only one condition (ESM) exists
- [x] ~~3.5 GREEN: `require('nextrush')` resolves in a CJS project~~ — explicitly NOT a goal; `require('nextrush')` is expected to fail per policy, with the documented interop path as the supported alternative

## 4. Verify and close

- [x] 4.1 `pnpm docs:validate:strict` green; policy doc links resolve; no doc claim contradicted by packaging
- [x] 4.2 Changeset added if release-impacting — none required (docs + a new CI conformance check; no packaging change since ESM-only was already the de facto state)
- [x] 4.3 Update the gap-checklist glyph for T051 (□ → ☑) with a Verified note citing the ratified decision and evidence

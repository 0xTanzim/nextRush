# Proposal

## Why

Three things are true at once, and each makes the next one harder to judge.

The archived request-path work is finished and verified but lives only on a local branch: 25 commits,
no upstream, nothing on `main`. The RFCs that govern it no longer match it — RFC-039 still says its
lazy-context phase is "in progress", RFC-040 says the same about the footprint phase, and RFC-029's
file status and index status disagree — so a reader cannot tell what shipped from what was planned.

Underneath that, the measurement base is half-built. RFC-039 P0 has exactly one profile (Bun,
hello-world, four headers). The Node response path — the path RFC-041 would rewrite — has no baseline
at all, and the POST and middleware-stack shapes are unprofiled. Two decisions are waiting on that
evidence: whether RFC-039 P2 (compiled request validator) and P3 (compiled response serializer) are
worth building, and whether RFC-041's recorded-response model is affordable on Node.

## What Changes

- **Land the completed work.** Open and merge the pull request for `feat/rfc-039-precompile-tax`
  (25 commits, the archived `fix-request-path-and-response-contract`). No code edits; verification
  only, and the pre-existing unrelated working-tree changes stay out.
- **Make the RFC record tell the truth.** Update RFC-039, RFC-040, and RFC-029 progress trackers and
  the RFC index to match what actually shipped, including the recorded divergence where `ctx.path`
  and `ctx.url` are published exactly as the platform delivered them rather than rewritten.
- **Complete RFC-039 P0's missing profiles.** Add dev-check profiling entries for a POST/body shape
  and a middleware-stack shape, then run profiles on Bun and Node for hello, POST, and middleware.
- **Record attribution, not just ratios.** Each measurement names the runtime, exact version, entry,
  iteration count, command, and machine caveat; each conclusion states whether it is measured or
  inferred.
- **Triage findings into two buckets.** Behaviour-preserving, measured wins are fixed here (with a
  failing test or allocation assertion first, and a before/after A/B). Anything that changes
  observable behaviour, or any architectural defect the profile names, is recorded as evidence and
  escalated to an RFC or the next change — not fixed here.
- **Record the verdict RFC-039 P0 exists to produce:** which of P2/P3 is justified by measurement, and
  what the Node baseline means for RFC-041.

## Capabilities

### New Capabilities

None. This change adds measurement coverage to an existing tool, reconciles documentation, and lands
already-shipped work; it does not introduce a durable behaviour of the framework.

### Modified Capabilities

None. No requirement changes: fixes are bounded to behaviour-preserving implementation details, and
anything that would change observable behaviour is out of scope by design (see Impact). The change
declares `skip_specs: true` rather than inventing a requirement to satisfy validation.

The two advisory `>500 characters` strict warnings the last sync introduced in `node-adapter` and
`router` are deliberately left alone. Fifteen other capabilities already carry that warning, the
requirement prose is contract text, and rewording it to satisfy a linter would trade real semantic
risk for a cosmetic count.

## Impact

- **Tooling:** `apps/benchmark/scripts/dev-check/entries/` gains profiling entries; the `profile`
  stage and its README gain the new shapes. No default-stage or budget behaviour changes unless a
  measured win earns a ratchet, and a ratchet is a separate, explicit task.
- **Docs/RFC:** `docs/RFC/runtime-adapters/039-*`, `040-*`, `docs/RFC/request-data/029-*`, and
  `docs/RFC/INDEX.md`.
- **Packages:** none, unless a measured behaviour-preserving fix is proven. Any such fix stays inside
  one module, adds no public API, and is accepted only past the run-to-run noise floor.
- **Out of scope, deliberately:** implementing RFC-041 (recorded response model), removing the
  `FB-03` known-failure exemption, changing the Node commit timing, or any change to
  compression/timer behaviour. Those wait for the §14 gate measurement that this change makes
  possible.

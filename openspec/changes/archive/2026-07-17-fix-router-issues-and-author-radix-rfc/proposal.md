> **Note (2026-07-17, post-completion doc reorg):** this change's tasks reference
> `docs/RFC/RFC-NEXTRUSH-ROUTER-RADIX.md`, the flat path that existed when this change was
> authored and completed. The RFC docs tree was subsequently reorganized into numbered, grouped
> subfolders; the file this change created now lives at
> `docs/RFC/runtime-adapters/015-router-radix.md`. Left as a historical record of what was true
> at completion time rather than rewritten — see `docs/RFC/INDEX.md` for the current layout.

## Why

A deep audit of `@nextrush/router` (2026-07-17, against real source + the code-intelligence
complexity graph) found the matching engine itself is genuinely well-built — O(k) segment trie,
O(1) static fast-path, pre-compiled executors, index-based scanning, zero per-request hot-path
complexity smells. The real issues are **documentation accuracy, one unfinished file split, and a
few small internal duplications** — none are correctness bugs, but the doc-accuracy ones matter
disproportionately because NextRush plans a future second router package (`@nextrush/router-radix`,
find-my-way-style) that would read the current router's types and docs as its reference contract.
Seeding a second package from inaccurate source is a real, avoidable risk.

This change does two things: (1) fixes every open current-router issue, and (2) authors an RFC
for the future radix package — RFC-gating it per this repo's `tdd-workflow.md` ("RFC before
implementation" for new packages), so the future work is born into a specified contract and a
conformance harness rather than a vacuum. The RFC is authored now; the radix package is NOT built
in this change.

Verified issues (each cited to real source):
- **Radix drift, code-level:** `packages/types/src/router.ts` header still says "The router uses
  a radix tree for efficient route matching" — the *only* remaining `radix` token in any `.ts`
  file (T002 swept `packages/router/src` but not `types`).
- **Radix drift, docs:** `packages/router/README.md` still has a "Radix Tree Algorithm" heading
  and "The radix tree router provides", directly contradicting its own opening line ("segment
  trie... not a compressed radix tree").
- **Stale type JSDoc:** `TrieNode.children`'s doc says "Children nodes keyed by first character",
  but the code keys by **whole segment** (`children.get(segment)`) — actively misleading,
  especially to a future radix-package author.
- **Unfinished split:** `router.ts` is 525 lines, still over the 300-line ceiling (T014 reduced
  it from 918 but didn't finish).
- **Internal duplication:** `EMPTY_PARAMS` is defined twice (`router.ts` + `match-route.ts`,
  deliberately, to dodge an import cycle — acknowledged in comments); a redundant `hasParams`
  post-loop in `matchRoute` re-scans keys after `matchNodeIndexed` already deletes on backtrack;
  path-normalization logic is encoded twice (`matchRoute` vs `findAllowedMethods`).

## What Changes

- Fix the radix→segment-trie drift repo-wide: `@nextrush/types` router header, `@nextrush/router`
  README, and the stale `TrieNode.children` "first character" JSDoc.
- Finish the `router.ts` split so no router source file exceeds 300 lines (completes the
  `router-module-size-compliance` requirement the unarchived `improve-router-modularity` change
  left partial — this change references and completes it, does not redefine it).
- Resolve the internal duplications the audit flagged: extract the shared `EMPTY_PARAMS` to one
  internal module both sites import (or document why an import cycle genuinely forces the dup);
  remove the redundant `hasParams` post-loop **only if** the existing test suite proves it
  behavior-preserving; consolidate the two path-normalization sites into one shared helper.
- Author `docs/RFC/RFC-NEXTRUSH-ROUTER-RADIX.md` specifying the future radix package: the shared
  `Router` contract it must implement, a router-conformance parity harness (modeled on the
  existing `packages/adapters/conformance`), the segment-trie-vs-radix tradeoff, sequencing, and
  the measurement-gated micro-optimizations (see Non-Goals) as radix design considerations.
- **Explicitly NOT in this change (Non-Goal, deferred to the RFC + a benchmark):** rewriting the
  matching hot path to avoid `Reflect.deleteProperty`'s V8 hidden-class deopt. That's the single
  most-executed function in the framework; rewriting it speculatively violates this repo's own
  "measure before optimizing" (`engineering-standards.md`, `AGENTS.md` §11) and carries
  per-request blast radius. It is captured in the RFC as a measurement-gated design item, to be
  settled by T017's benchmark, not bundled into a docs+split cleanup.
- **BREAKING**: None. Doc corrections, an internal file split (public-surface snapshot proves
  no export change), and internal dedup with no observable behavior change.

## Capabilities

### New Capabilities

- `router-doc-accuracy`: The requirement that all router documentation and type-level doc
  comments (across `@nextrush/router` and `@nextrush/types`) accurately describe the segment-trie
  algorithm actually implemented, with no residual "radix tree" claims and no stale structural
  descriptions.
- `router-structure-and-dedup`: The requirement that router source files stay within the
  300-line ceiling and that the internally-duplicated helpers the audit identified are resolved
  to single sources (or their duplication explicitly justified), with all behavior preserved.
- `router-radix-rfc`: The requirement that a published RFC specifies the future radix router
  package's contract, conformance-parity model, scope, and design tradeoffs before that package
  is implemented.

### Modified Capabilities

- None in the main specs. This change completes (does not redefine) the
  `router-module-size-compliance` requirement introduced by the still-unarchived
  `improve-router-modularity-and-class-dx-papercuts` change — cross-referenced in tasks, not
  duplicated here.

## Impact

- **Affected code:** `packages/types/src/router.ts` (header doc), `packages/router/README.md`,
  `packages/router/src/segment-trie.ts` (`TrieNode.children` JSDoc), `packages/router/src/router.ts`
  (finish split), new extracted router module(s), `packages/router/src/match-route.ts` +
  `packages/router/src/matching.ts` (dedup EMPTY_PARAMS / normalization / hasParams loop).
- **Affected docs:** the new `docs/RFC/RFC-NEXTRUSH-ROUTER-RADIX.md`; router README.
- **Dependencies:** Builds on the router split already committed in
  `improve-router-modularity-and-class-dx-papercuts`. The RFC references T017 (class/router
  benchmark) as the evidence gate for the radix package's "why" and for the deferred hot-path
  optimization.
- **Systems:** Internal-package + docs only. No new network surface, no new runtime dependency,
  no production behavior change. The RFC commits NextRush to nothing at runtime — it is a design
  artifact that future work must satisfy, not code.

# ADR-0008 — `dev-tooling` capability & verification-first hardening of `@nextrush/dev`

- **Status:** `Accepted`
- **Date:** `2026-07`
- **Deciders:** Developer Tooling review / maintainers
- **Governing RFC:** `docs/RFC/dev-tooling/019-dev-tooling-capability.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0005` (package tiers & sealed surface)

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[█████████████░░░░░░░]` **Accepted** — 2 / 3

---

## Context

`@nextrush/dev` is on every developer's critical path yet is the only major surface with no
capability spec. A deep review (`report/dev/dev-tooling-review.md`, commit `ef95e3f`) found it
shipping real correctness bugs behind a green suite: 39.79% line coverage with the dev-server,
SWC-builder, Deno-builder, and Bun-builder at 0%. The Deno build is broken (passes objects to
`node:path` string APIs) but compiles clean because `import(NODE_*)` variable specifiers type Node
built-ins as `any`; the incremental cache is dead because it lives inside the `outDir` that
`--clean` wipes; `.d.ts` emission is gated on the wrong flag; and the one dev integration test keys
success on a banner printed before the child spawns, never a live server. A decision is needed on
how to represent and stabilize this toolchain without re-shipping unverified fixes.

## Decision

We will (1) introduce a new, durable `dev-tooling` OpenSpec capability that gives the toolchain an
explicit, testable contract, and (2) harden the package **verification-first** — land the verifier
(typed Node built-ins, a liveness-checked dev test, and real Deno/Bun build tests) before fixing the
correctness defects, so every fix is validated by an independent check that was RED beforehand.

Because the defects all live in 0%-coverage files, fixing them first would repeat the exact failure
mode that let them ship. A capability spec makes the guarantees answerable; verification-first makes
the fixes trustworthy. No public programmatic API changes; two CLI behavior changes (bare-`--watch`
default, `.d.ts` decoupled from decorator metadata) are documented bug-fixes/portability wins.

## Options considered

- **New `dev-tooling` capability + verification-first** — ✅ chosen: honest fit (no existing
  capability owns the dev server/build) and it prevents re-shipping unverified fixes.
- **Fold into `adapter-development-kit`** — ❌ rejected: it owns only the `generate adapter`
  scaffolder; stretching it is a change-shaped misfit.
- **Fix bugs first, add tests later** — ❌ rejected: repeats the failure mode that shipped the bugs.
- **Do nothing** — ❌ rejected: Deno build stays broken under a "Stable" banner, cache stays inert,
  `tsc` stays blind, and the next regression ships green.

## Consequences

- **Positive:** the toolchain gains a testable contract; correctness defects are fixed and can't
  silently regress; `tsc` is restored as a backstop over the I/O layer; "stable" claims become true.
- **Negative / cost:** CI expands to run real Bun/Deno jobs; one round of coverage work to reach the
  90% bar; a documented change to the default dev watch semantics.
- **Neutral:** the SWC-everywhere / native-watcher / local-`tsc` architecture is unchanged — this
  ratifies it, it does not redesign it.
- **Follow-up:** confirm the minimum Node version for Linux `--watch-path` (may retire the fallback
  guard); decide keep-vs-soften on the Bun decorator-metadata claim once a conformance test exists.

## Compliance / enforcement

Enforced by the OpenSpec change `dev-tooling-reliability` (its `tasks.md` gates: coverage ≥ 90%,
`tsc`/ESLint clean, cross-runtime CI, `openspec validate --strict`), plus the new liveness/Deno/Bun
integration tests in CI and the `validate:esm-only` check guarding the `node:` prefix. The capability
spec (`openspec/specs/dev-tooling/`) is the living contract reviewers check changes against.

---

## Checklist

- [x] One decision only (capability + its verification-first sequencing are one coherent decision).
- [x] Context states the forces/trigger (the review findings) without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, alternatives, and "do nothing".
- [x] Consequences include real negatives/costs (CI expansion, coverage work, behavior change).
- [x] Compliance/enforcement names concrete mechanisms (OpenSpec gates, CI tests, esm-only check).
- [x] Lifecycle progress bar reflects the current Status field (Proposed).
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [x] Registered in docs/adr/INDEX.md.

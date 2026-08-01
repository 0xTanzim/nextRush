# ADR-0013 — Thin `nextrush` CLI launcher on the meta-package for dev-toolkit discoverability

- **Status:** `Accepted`
- **Date:** `2026-07`
- **Deciders:** Framework Architecture Review
- **Governing RFC:** `docs/RFC/framework-composition/020-framework-composition-integrity.md` (§21 addendum)
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0009`, `ADR-0008`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[█████████████░░░░░░░]` **Accepted** — 2 / 3

---

## Context

RFC-020 removed the `postinstall` script that advertised the optional `@nextrush/dev` toolkit and
relocated discovery to "README + scaffolder + CLI message". The CLI-message half was specified but
unbuildable as it stood: `nextrush` declared no `bin`, so nothing existed to print a message when
`@nextrush/dev` was absent — and `@nextrush/dev`, the only package that could, is the one that
might be missing. A `command not found` from the shell happens before any JavaScript runs, so a
docs-only fix cannot satisfy the committed "prints an actionable install message" scenario. The
trigger is external review `fed.md` (Option 1) plus the already-committed scenario in
`openspec/specs/framework-composition/spec.md`.

---

## Decision

We will ship a thin `bin` launcher on the `nextrush` meta-package (`bin: { nextrush }` →
`bin/nextrush.js`) whose sole job is delegate-or-explain: resolve `@nextrush/dev`'s CLI, import it
in-process and invoke its `cli()` on success, and on the specific missing-module case print a
package-manager-aware install message (naming `@nextrush/dev`, the exact install command, and a
one-line description) then exit non-zero. Any unrelated error passes through unchanged. The launcher
runs only on explicit `nextrush <command>` invocation — never at install time.

Because delegation is in-process and `@nextrush/dev`'s `cli()` self-exits with its own code, the
success path mirrors the underlying exit code for free; the launcher controls the exit code only on
the missing path. `@nextrush/dev`'s manifest is left unchanged — its pre-existing `nextrush` bin
coexists with the meta's (a spike on pnpm 11.10 confirmed duplicate bin names install benignly with
no error/warning, and both route to the same `cli()` when the toolkit is present).

---

## Options considered

- **Thin meta-package launcher (delegate-or-explain, in-process)** — ✅ chosen: _only mechanism that
  can answer a shell-level `command not found`; zero change to `@nextrush/dev`._
- **`@nextrush/dev` drops its `nextrush` bin so the meta is sole owner** — ❌ rejected: _restructures
  another capability's public bin surface; unjustified once the spike proved no install failure._
- **Spawn `@nextrush/dev`'s bin as a child process** — ❌ rejected: _unnecessary process hop;
  `process.execPath` is the wrong binary under Deno/Bun scaffolds._
- **Documentation-only** — ❌ rejected: _cannot intercept a resolution failure that precedes any code._
- **Do nothing** — ❌ rejected: _leaves a committed spec scenario unimplemented — a defect, not a nuance._

---

## Consequences

- **Positive:** the committed "actionable dev-CLI discovery" scenario becomes real and test-backed;
  a functional-only install still gets a helpful message instead of raw `command not found`.
- **Negative / cost:** `nextrush` and `@nextrush/dev` both declare a `nextrush` bin, so in a
  full install the package manager links one non-deterministically (behaviorally identical since
  both route to `cli()`); a future `@nextrush/dev` bin-behavior divergence would make which links
  matter — tracked as a documented follow-up, not resolved here.
- **Neutral:** first `bin` field the meta-package has ever shipped; the canonical-manifest lock now
  accounts for it.
- **Follow-up:** a possible `dev-tooling` change making the meta the sole `nextrush` owner if
  divergence risk materializes; the deferred `nextrush doctor` idea from `fed.md`.

---

## Compliance / enforcement

Kept true by the manifest-lock tests: `scripts/__tests__/validate-manifest-composition.test.ts` and
`packages/nextrush/src/__tests__/{package-manifest,no-install-script}.test.ts` assert the meta `bin`
exists, points to a file in `files`, and is wired to no install-lifecycle script; the launcher's own
unit tests (`packages/nextrush/src/__tests__/dev-cli-launcher.test.ts`) lock the delegate-or-explain
contract and the no-side-effect-at-import guarantee.

---

## Checklist

- [x] One decision only.
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, ≥1 alternative, and "do nothing".
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism.
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [x] Registered in docs/adr/INDEX.md.

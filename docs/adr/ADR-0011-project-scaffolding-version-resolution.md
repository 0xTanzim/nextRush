# ADR-0011 — Per-package version resolution with a build-time fallback map for `create-nextrush`

- **Status:** `Accepted · Shipped`
- **Date:** `2026-07`
- **Deciders:** Scaffolding/CLI audit / maintainers
- **Governing RFC:** `docs/RFC/scaffolding/021-project-scaffolding-capability.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0008` (dev-tooling capability & verification-first hardening)

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[████████████████████]` **Shipped** — 3 / 3

---

## Context

`create-nextrush`'s version resolver (`npm-version.ts`) probes exactly two packages — `nextrush`
and `@nextrush/cors` — and fans their two resolved ranges across roughly ten independently
versioned `@nextrush/*` packages via `templates/shared.ts` and `constants.ts`. The monorepo's own
`.changeset/config.json` `fixed` group proves this proxy is invalid: `@nextrush/dev`,
`@nextrush/rate-limit`, `@nextrush/request-id`, `@nextrush/adapter-bun`, and
`@nextrush/adapter-deno` are all on the `1.0.0` line while the two probes report the `3.1.0` line,
so every generated project pins `@nextrush/dev: ^3.1.0` in `devDependencies` — a range with no
matching published version. `npm install` therefore fails for every scaffolded project, on every
style, runtime, and middleware combination (`report/scaffolding/scaffolding-cli-review.md`, F-01).
The only existing verifier (`generator.test.ts`) mocks two version scalars and asserts on file
structure, never on whether an emitted range actually resolves — so the defect shipped invisibly.
A decision is needed on how the resolver should represent and fall back on framework-package
versions, and how the fix should be verified so it cannot silently regress.

## Decision

We will replace the two-probe version proxy with **per-package version resolution**: every
dependency the chosen `{style, runtime, middleware}` combination emits is resolved from its own
`/{pkg}/latest` registry entry, run in parallel under one shared timeout budget. When the registry
is unreachable, resolution falls back to a **build-time-injected per-package map** — not two
scalars — built by `tsup.config.ts` reading each relevant workspace `package.json` directly. We
will additionally land a generate-then-install CI matrix over every `style × runtime × middleware`
cell as the system-of-record verifier for the install-integrity claim, mirroring the
verification-first sequencing `ADR-0008` already established for `@nextrush/dev`.

Because every `@nextrush/*` package versions independently by design (the changeset `fixed` group
is deliberately small), any representation narrower than "one version per emitted package" will
eventually re-break the same way as new packages diverge further. A real CI gate is required
because a mocked-registry unit test would re-encode the same wrong assumption that let F-01 ship
undetected.

## Options considered

- **Per-package resolution + build-time fallback map + CI install matrix** — ✅ chosen: the only
  representation consistent with the framework's documented independent-versioning model, verified
  by a gate that proves installability rather than asserting mocked structure.
- **Add the drifted packages to the changeset `fixed` group** — ❌ rejected: couples release
  cadence framework-wide purely to satisfy the scaffolder, and fights the documented independent-
  versioning model.
- **Hardcode a version table in templates** — ❌ rejected: reintroduces the exact staleness the
  original dynamic-probe design was built to avoid.
- **Do nothing** — ❌ rejected: every generated project keeps failing `npm install`; the
  scaffolder cannot deliver its one promise, and the failure is undiagnosable because install
  output is currently swallowed (`stdio: 'ignore'`).

## Consequences

- **Positive:** every generated dependency range is guaranteed resolvable at scaffold time; the
  fix is provably correct via a real CI gate, not self-reported; the design now matches the
  framework's actual, independently-versioned release model.
- **Negative / cost:** more registry calls at scaffold time (bounded by one shared timeout, same
  ceiling as today); the CI matrix adds job time proportional to the combination count; the
  fallback map must be kept in sync by `tsup.config.ts` reading the workspace (mitigated by the
  matrix catching staleness).
- **Neutral:** `create-nextrush`'s public API is unchanged — this is an internal resolution-
  mechanism change plus a correction to previously-broken generated output, not a new contract.
- **Follow-up:** the Deno/Bun runtime-honesty fixes and generated-config correctness items in the
  same OpenSpec change (`project-scaffolding-hardening`) build on this resolver but are tracked as
  their own tasks, not folded into this ADR.

## Compliance / enforcement

Enforced by the OpenSpec change `project-scaffolding-hardening`'s gates: the generate-then-install
CI matrix (fails the build when any generated combination pins an unresolvable range), unit tests
on the resolver/version-store asserting per-package independence (a stub registry where
`@nextrush/dev` is deliberately on a different major line than `nextrush`), and the package's
90%+ coverage bar. The capability spec (`openspec/specs/project-scaffolding/`) is the living
contract future changes to the resolver are checked against.

---

## Checklist

- [x] One decision only (per-package resolution + its fallback map and verifier are one coherent decision).
- [x] Context states the forces/trigger (the review finding, the changeset config) without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, alternatives, and "do nothing".
- [x] Consequences include real negatives/costs (more registry calls, CI time, fallback-map upkeep).
- [x] Compliance/enforcement names concrete mechanisms (CI matrix, unit tests, coverage bar).
- [x] Lifecycle progress bar reflects the current Status field (Accepted).
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [x] Registered in docs/adr/INDEX.md.

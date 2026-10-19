# Fix briefs — validated issues from the 2026-10 architecture audit

Each brief is **self-contained**: an agent (or a cheaper model) can pick one file, fix it, and prove
the fix without reading the audit. They come from
[`../architecture-audit-validation-followup.md`](../architecture-audit-validation-followup.md), which
explains how each issue was found and measured.

## How to use a brief with an agent

1. Give the agent **one brief file** plus `AGENTS.md`. Nothing else is required.
2. The agent runs the brief's **Reproduce** command first and sees the failure (`KNOWN` probe).
3. It writes the **Tests first** (the repo is TDD — `tdd-workflow.md`), then the fix.
4. It runs `node apps/benchmark/scripts/dev-check/check.mjs probe --rt bun` **and** `--rt node`
   (about 10 s each) plus the package's own tests.
5. In the **same PR** it removes the brief's id from `knownFailures` in
   `apps/benchmark/scripts/dev-check/budgets.json`. From then on the probe is a regression guard.

## Order and dependencies

| Brief | Issue | Severity | Size | Depends on | RFC-gated |
| --- | --- | --- | --- | --- | --- |
| [FB-06](fb-06-router-param-case-lowercasing.md) | `ctx.params` are lower-cased on every request | **Critical** (silent data corruption) | S | — | No |
| [FB-01](fb-01-json-commit-order-hang.md) | `ctx.json()` hangs (Node) / empty 200 (Web) on serialization error | **High** | S | — | No |
| [FB-02](fb-02-createhandler-boot-trap.md) | `createHandler(app)` on Bun/Deno silently drops routes | **High** (DX trap) | S | — | No |
| [FB-05](fb-05-error-body-contract.md) | Wrong `code`, engine-specific messages, no 415 | Medium | S–M | — | No (RFC 9457 is separate) |
| [FB-04](fb-04-dot-segment-adapter-parity.md) | Dot-segment rejection only works on Node | Medium (security parity) | M | — | No |
| [FB-03](fb-03-response-commit-model-and-compression.md) | Eager response commit: Node/Web diverge, `compression` is a no-op | **✅ Done** — RFC-041 (2026-10-19) | M now, L for the model | FB-01 | Yes — RFC-041, adopted |
| [FB-07](fb-07-web-adapter-request-footprint.md) | Bun per-request cost ≈ 2× Hono | Perf | M | RFC-039 / RFC-040 | No (RFC-039 owns it) |
| [GP](gp-architecture-gaps-plan.md) | Architectural gaps (typed routes, parity, tests, governance) | Plan | L | varies | Yes |

Recommended sequence: **FB-06 → FB-01 → FB-02 → FB-05 → FB-04 → ~~FB-03~~ ✅ → FB-07 → GP items.**
FB-06, FB-01 and FB-02 are small, independent and can run in parallel with three agents.

## Structural debt found while shipping RFC-041 (not fixed there)

These are pre-existing and outlive the response-model change. They are recorded so they get their own
change rather than a drive-by refactor inside a behaviour change. Each is a `code-structure.md`
violation: the 300-line hard cap for a source file.

| File | Lines | Why it was not split in RFC-041 |
| --- | --- | --- |
| `packages/adapters/conformance/src/suite.ts` | 965 | One file holds every scenario; splitting by capability is a mechanical but large move that would touch every driver's evidence ledger |
| `packages/adapters/node/src/context.ts` | 845 | The Context shell: request accessors, cookies, streaming, and the response record. A split needs the streaming runners and body source extracted first |
| `packages/adapters/node/src/adapter.ts` | 792 | Listener, drain-aware `writeHead`, `serve`, `listen` and the deprecated aliases. Splitting it risks the drain contract, which is single-implementation by design |
| `packages/middleware/compression/src/middleware.ts` | 431 | Options resolution, eligibility, and the rewrite. The outgoing-response accessor was already extracted to `outgoing.ts` (RFC-041); the rest is a follow-up |

A fifth violation was fixed in RFC-041 itself rather than deferred: `packages/runtime/src/outgoing-response.ts`
was 313 lines after the length-invalidation change, and the once-per-process report moved to
`outgoing-warnings.ts` (292 lines).

## Rules every brief assumes

- TDD: failing test first, then the fix. Strict TypeScript, **no `any`**, files ≤ 300 lines
  (`code-structure.md`), no runtime `new Function` / `eval` (RFC-040 invariant).
- Behaviour must be **identical on every adapter** unless the brief explicitly records a platform
  limitation (ADR-0010). A fix that works on Node only is not done.
- A bug fix that changes observable behaviour gets a CHANGELOG line and a docs update in the same PR.
- Conformance: if the fix touches request/response behaviour, add the scenario to
  `packages/adapters/conformance` so every adapter runs it.
- Commit only when the maintainer asks.

## Standard commands

```bash
node apps/benchmark/scripts/dev-check/check.mjs probe --rt bun    # ~2 s
node apps/benchmark/scripts/dev-check/check.mjs probe --rt node   # ~8 s
node apps/benchmark/scripts/dev-check/check.mjs inproc            # ~15 s, perf before/after
pnpm --filter @nextrush/<package> test
pnpm typecheck && pnpm lint
```

See `.agents/skills/framework-profiling/SKILL.md` for how to read and extend `dev-check`.

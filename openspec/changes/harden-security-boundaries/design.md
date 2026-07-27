## Context

`report/security-review.md` (commit `5ed6cdc`) records 19 findings across the framework's security
surface. Eleven of them are instances of one architectural gap rather than eleven independent bugs:
**a security decision is derived from a value another consumer normalized for a different purpose, or
from a value an attacker controls.**

Three concrete manifestations, each verified in source:

- `packages/runtime/src/headers.ts` → `resolveClientIp()` selects `forwarded.split(',')[0]` — the
  leftmost `X-Forwarded-For` entry, which a conforming proxy leaves client-authored because it appends
  its own view to the right. `packages/middleware/rate-limit/src/utils/key-generator.ts` widens this
  to the first of eight vendor headers.
- `packages/router/src/match-route.ts` → `matchRoute()` lowercases the path for its own trie lookup and
  keeps the folded value local; `ctx.path` stays the raw target. With `caseSensitive: false` (the
  default in `packages/router/src/state.ts`), the router and any path-prefix guard compare different
  strings.
- `packages/middleware/csrf/src/middleware.ts` → `resolveOptions()` coerces an omitted `cookie.maxAge`
  to `0` and `serializeCookie()` emits it unconditionally, so the default token cookie carries
  `Max-Age=0` and is deleted on arrival (RFC 6265 §5.2.2) — contradicting the package's own README and
  `types.ts`, and untested because the suite only covers `maxAge: 3600`.

Constraints this design operates under: zero runtime dependencies in `core`/`router`/`errors`/`types`/
`adapters`/`middleware`; lower packages never import from higher (`.kiro/steering/architecture.instructions.md`);
no `node:*` or `process` in `core`/`router`/`middleware`; 300-line per-file ceiling; behavior identical
across Node/Bun/Deno/Edge, proven by `packages/adapters/conformance`, not asserted. Four decisions here
are RFC-gated per AGENTS.md §20-21 and must have an approved `docs/RFC/` entry before code lands.

## Goals / Non-Goals

**Goals:**

- Close the architectural gap first, then the findings that fall out of it — one canonicalization owner
  and one typed trust boundary, so the next instance of this class cannot be written.
- Resolve all 19 findings (SEC-01…SEC-19), each traceable to a requirement in `specs/` and a task.
- Make insecure configuration unrepresentable or boot-fatal rather than documented, extending the
  pattern `@nextrush/cors` already applies to `credentials + origin:'*'`.
- Partition the work into six workstreams that can be executed by parallel subagents against
  non-overlapping file sets, with explicit dependency gates where overlap is unavoidable.
- Leave behind the test suites (property/fuzz, raw-socket malformed-request, security conformance
  scenarios) that make the next audit cheaper than this one.

**Non-Goals:**

- Implementing `@nextrush/session`. SEC-16's remediation is satisfied by a documented position plus an
  approved RFC; the package is a separate RFC-gated change. Bundling a new package here would make an
  already large change unreviewable.
- Auditing or fixing the surface the review did not read: Node request parsing beyond the new
  raw-socket suite, `multipart/parser.ts`/`scanner.ts`/`storage/`, `body-parser/json.ts` charset
  handling, `@nextrush/template` auto-escaping, `class` guards/interceptors, `websocket`/`stream`/
  `openapi`/`logger`. These need their own audit change; this one does not pretend to cover them.
- Performance optimization. Every existing hot-path guarantee in the `router` and `node-adapter` specs
  must be preserved, but no new optimization is in scope.
- A full Public Suffix List. SEC-18's fix is an injection point plus a warning, not vendoring the PSL —
  which would violate the zero-dependency rule for a P4.

## Decisions

### D1 — One canonicalization owner in `@nextrush/router`, not in each adapter

`canonicalizePath()` lives in `@nextrush/router` and is the sole definition of case handling,
slash collapsing, trailing-slash policy, and dot-segment detection. Adapters call it once per request
and publish the result as `ctx.path`, keeping the raw target as `ctx.originalPath`.

*Why the router and not the runtime or each adapter:* the router already owns the normalization rules
(`collapseAndStrip`, `isProvablyLowerAscii`) and owns the per-router `caseSensitive`/`strict` options
that parameterize them. Moving the rules up to `runtime` would separate them from the options that
configure them and duplicate the trie's segment semantics. Leaving them per-adapter is what produced
SEC-02.

*Rejected — normalize in each adapter:* four implementations, guaranteed drift, and the exact failure
this change exists to remove.
*Rejected — a new `@nextrush/path` package:* a new package for one function is RFC-gated overhead for
no boundary benefit; `router` already depends on nothing above it.

*Layering check:* adapters sit above `router` in the hierarchy, so an adapter importing `router` is
legal. The router remains free of `node:*`.

### D2 — Reject dot segments (400) rather than resolve them

`remove_dot_segments` (RFC 3986 §5.2.4) is what a proxy does; performing it in the application creates
a second, differently-timed resolution and therefore a desync window. Rejecting is the framework's
stated preference (`report/security-review.md`, engineering-standards "prefer rejecting invalid input
over attempting recovery") and no legitimate client emits a dot segment in a request target.

*Why not resolve:* an application that resolves `/api/../admin` to `/admin` dispatches a request that a
proxy-level ACL evaluated as `/api/...`. Resolution converts a 400 into an authorization question.
*Trade-off accepted:* a client that hand-builds relative paths now gets a 400. This is a behavior change
worth calling out in the migration guide; it is not breaking for any well-formed client.

Detection must be a linear scan, not a regular expression, to avoid trading a path bug for a ReDoS.

### D3 — Flip `caseSensitive` to `true` by default (**BREAKING**)

Publishing the folded path (D1) removes the *bypass*; it does not remove the *surprise* that
`/ADMIN/users` reaches a handler registered at `/admin/users`. RFC 3986 §6.2.2.1 defines the path as
case-sensitive, and Fastify defaults accordingly.

*Why both D1 and D3 rather than only one:* D1 alone leaves case-insensitive matching correct but
astonishing; D3 alone leaves every other normalization axis (slashes, trailing slash) still diverging.
D1 is the structural fix and ships first; D3 is the default change and needs the major-release lane.
*Sequencing:* D1 is additive and lands in this change. D3 is gated on the same RFC and lands in this
change only if the release is a major; otherwise it ships as a follow-up with the RFC already approved.
`tasks.md` marks it explicitly so the decision is visible at execution time, not discovered.

### D4 — Proxy trust becomes `false | number | string[]` (**BREAKING**)

`proxy: number` = hops to skip from the right of `X-Forwarded-For`. `proxy: string[]` = trusted peer
CIDRs; walk the chain right-to-left, stop at the first address outside the set. `proxy: true` throws at
boot naming both replacements. Vendor headers (`cf-connecting-ip`) are honored only when the direct
peer is covered.

*Why a type change rather than fixing the parse:* `resolveClientIp()` faithfully implements a policy a
boolean cannot state safely. There is no correct leftmost-vs-rightmost answer without knowing how many
hops to trust. Fixing only the direction would break single-proxy deployments that currently work by
accident.

*Rejected — Express's string DSL (`'loopback, 10.0.0.1'`):* stringly-typed configuration in a framework
whose selling point is type safety; parsing a DSL is more code than accepting the two shapes directly.
*Rejected — always use the direct peer:* correct but unusable behind any load balancer.

*Edge constraint:* the Edge adapter has no direct peer address, so a CIDR list is unverifiable there.
That configuration is refused at boot rather than silently degraded — a peer list that cannot be checked
is a false sense of security. Hop counts remain available on Edge.

### D5 — Bind every signature to its context using the construction `csrf` already has

`csrf/token.ts` → `buildMessage()` already signs a length-prefixed
`<len>!<sessionId>!<len>!<random>` tuple. `cookies/signing.ts` signs the bare value. Unify on the
stronger construction: sign `<len>!<name>!<len>!<value>!<len>!<issuedAt>`.

*Why length-prefixed rather than a delimiter:* a delimiter-joined message is ambiguous when a field can
contain the delimiter, which is exactly how signature-confusion attacks work. Length prefixes make the
encoding injective.

*Migration:* **BREAKING** for existing signed cookies. `acceptLegacySignatures: true` accepts the old
value-only format during a rotation window, is off by default, and logs once per process. Documented as
temporary in the migration guide with a removal target.

### D6 — Fail-closed is a spec-level rule, not per-middleware judgement

`specs/security-boundaries/spec.md` states the rule once ("a missing signal is not a pass"; "an
unparseable value is rejected, not coerced"; "an internal error denies the request") and each middleware
inherits it. SEC-04's three fail-open branches in `checkOrigin()` (`!origin → true`,
`Sec-Fetch-Site: none → true`, `Origin` vs `Host`) are then not three separate fixes but three
violations of one stated requirement.

### D7 — Boot-time production audit over per-request warnings

A single audit at `app.ready()` in production throws on `proxy: true` and
`cors({ origin: true, credentials: true })`, and warns once on `dotfiles: 'allow'`,
`includeStack: true`, `secure: false`. `cors`'s existing `securityWarning()` becomes one input to it.

*Why boot and not per-request:* a per-request check costs the hot path and floods logs; a boot check is
free and unmissable. *Why throw for some and warn for others:* throwing on a setting with a legitimate
use (serving dotfiles deliberately) would make the framework wrong; throwing on a setting with no
legitimate production use (`proxy: true`, which is now unrepresentable-by-intent) is correct.

*Rejected — lint rule only:* a lint rule does not run in the deployed process and does not see runtime
configuration.

### D8 — Six workstreams, partitioned by file ownership so subagents cannot collide

Each workstream owns a disjoint file set and runs in its own git worktree/branch. Only two hard gates
exist, both because a downstream consumer needs an upstream export.

```mermaid
stateDiagram-v2
    [*] --> RFCs
    RFCs --> A: canonical-path RFC approved
    RFCs --> B: proxy-trust RFC approved
    RFCs --> D: signature-binding RFC approved
    RFCs --> F_rfc: session position RFC

    A --> C: canonicalizePath() exported
    B --> E_rl: ctx.ip policy available
    A --> F
    B --> F
    C --> F
    D --> F
    E --> F
    F_rfc --> F

    state A { direction LR
      [*] --> canonicalize --> reject_dots --> publish_ctx_path --> prefix_matching
    }
    state E { direction LR
      [*] --> cors_headers --> static_untrusted --> header_grammar --> sendfile_fd --> includeStack --> compression_docs
    }
    A: A — canonical path (router, adapters)
    B: B — proxy trust (runtime, adapters, rate-limit)
    C: C — CSRF correctness (csrf only)
    D: D — cookie integrity (cookies only)
    E: E — response/content boundaries (cors, static, runtime, errors, compression)
    E_rl: E' — rate-limit key via ctx.ip
    F: F — enforcement, presets, fuzz, conformance
    F_rfc: F₀ — session RFC + position doc
```

| WS | Owns (files) | Findings | Depends on |
| -- | ------------ | -------- | ---------- |
| A | `router/src/{matching,state,match-route,find-node}.ts`, adapter `context.ts` path getters | SEC-02, SEC-09 | canonical-path RFC |
| B | `runtime/src/headers.ts`, adapter `context.ts` IP getters, `rate-limit/src/utils/key-generator.ts` | SEC-01 | proxy-trust RFC |
| C | `middleware/csrf/src/**` | SEC-03, 04, 05, 06, 15, 19 | A (for canonical `excludePaths`) |
| D | `middleware/cookies/src/**` | SEC-07, 08, 18 | signature RFC |
| E | `middleware/{cors,static,compression}/src/**`, `runtime/src/response-builder.ts`, `errors/src/middleware.ts` | SEC-10, 11, 12, 13, 14, 17 | — |
| F | `core/src/application.ts`, `adapters/conformance/src/**`, new preset + fuzz + raw-socket suites, docs | SEC-16 + all validation | A, B, C, D, E |

*Collision risk and its mitigation:* A and B both touch adapter `context.ts`. They are sequenced A→B on
that file only (B rebases on A) rather than parallelized, because two agents editing one file is the
failure mode worktrees exist to prevent. Everything else is genuinely disjoint. `E` is internally
ordered but has no external dependency, so it can start immediately alongside A.

### D9 — Every finding maps to a requirement and a task, verifiably

| Finding | Severity | Requirement location | WS |
| ------- | -------- | -------------------- | -- |
| SEC-01 client IP | P1 | `node-adapter` ADDED proxy trust; `web-adapters` MODIFIED; `security-boundaries` rate-limit key | B |
| SEC-02 case-fold bypass | P1 | `router` ADDED canonicalize + published path; MODIFIED case-normalization | A |
| SEC-03 CSRF `Max-Age=0` | P2 | `security-boundaries` CSRF cookie persistence | C |
| SEC-04 origin check | P2 | `security-boundaries` CSRF origin validation | C |
| SEC-05 session binding | P2 | `security-boundaries` CSRF session binding | C |
| SEC-06 blinding key | P2 | `security-boundaries` constant-time comparison | C |
| SEC-07 signature scope | P2 | `security-boundaries` signed artifacts bind context | D |
| SEC-08 cookie `Secure` | P2 | `security-boundaries` cookies default Secure | D |
| SEC-09 dot segments | P2 | `router` ADDED dot-segment rejection | A |
| SEC-10 CORS echo | P2 | `security-boundaries` CORS intersection | E |
| SEC-11 inline SVG/HTML | P2 | `security-boundaries` static untrusted mode | E |
| SEC-12 header grammar | P3 | `runtime-adapter-contract` ADDED header validation | E |
| SEC-13 static TOCTOU | P3 | `security-boundaries` symlink-swap safety | E |
| SEC-14 `includeStack` | P3 | `security-boundaries` production stack traces | E |
| SEC-15 `/*` depth | P3 | `security-boundaries` exemption wildcard depth | C |
| SEC-16 no session | P3 | proposal position + RFC (deliverable, not code) | F |
| SEC-17 BREACH | P3 | `security-boundaries` (docs + `skip` + `no-transform`) | E |
| SEC-18 partial PSL | P4 | `security-boundaries` cookies (injection point) | D |
| SEC-19 token in query | P4 | `security-boundaries` token extractor | C |

`tasks.md` carries the reverse index so no finding can be closed without a task, and a final task
asserts the mapping is complete.

### D10 — TDD, and the missing test is itself the finding

Every task is RED→GREEN→REFACTOR per `.kiro/steering/tdd-workflow.md`. SEC-03 exists specifically
because an integration test ("issue a token, then validate it, under default options") was never
written — the unit test asserting `Max-Age=3600` passed while the default path was broken. So each
workstream's first task is the failing test that reproduces the finding at the observable-behavior
level, not at the unit level where the bug hid.

## Risks / Trade-offs

- **Three simultaneous breaking changes (`ctx.path`, `proxy`, signed cookies) is a large migration
  surface.** → All three ship in one major with one migration guide and one codemod-able pattern each;
  `proxy: true` and legacy signatures fail loudly with the replacement named in the error, so no
  silent behavior change reaches production. `ctx.originalPath` and `acceptLegacySignatures` give an
  escape hatch per change.
- **Dot-segment rejection may break a real client that builds relative paths.** → Called out in the
  migration guide with the exact 400 response shape; the alternative (resolving) trades a client-facing
  400 for a proxy-desync authorization question, which is the worse trade.
- **`caseSensitive: true` silently 404s routes that previously matched.** → Highest-blast-radius item
  here. Mitigated by shipping D1 (published canonical path) first so the *security* problem is closed
  independently, making D3 a correctness/astonishment fix that can wait for the major if needed. A
  startup diagnostic can list routes whose registered path is not all-lowercase.
- **Canonicalization on the hot path costs allocations the router spec explicitly forbids.** → The
  existing `isProvablyLowerAscii` / `includes('//')` fast paths are preserved; dot-segment detection is
  a single linear scan with no allocation on the overwhelmingly common clean path. The `performance-gate`
  capability's smoke profile is a required gate on workstream A, and a regression there blocks the
  workstream rather than being accepted.
- **Six parallel workstreams can still collide on shared test infrastructure and lockfiles.** → Only
  A→B share a file and are sequenced, not parallelized. Each workstream gets its own worktree; the
  integrator merges in blast-radius order (low first) and runs the full repo suite before the final
  merge, not just per-package suites.
- **The boot audit could throw in a legitimate deployment and take an app down on upgrade.** → It throws
  only for configuration that is already invalid under the new types (`proxy: true`) or already
  documented as unsafe with no legitimate production use; everything debatable warns. The audit runs at
  `app.ready()`, so failure surfaces at deploy time, not mid-traffic.
- **Fixing 19 findings creates the impression the framework is now audited.** → It is not: the
  un-reviewed surface in *Non-Goals* is larger than what was reviewed, and `@nextrush/template`'s
  escaping is a first-order XSS surface nobody has read. The proposal names the follow-up explicitly so
  "security review complete" is never claimable from this change alone.

## Migration Plan

1. Land the four RFCs and their ADRs (`docs/RFC/`, `docs/adr/`) — gate for A, B, D, F.
2. Merge A (canonical path, additive) → run `performance-gate` smoke + full conformance.
3. Rebase and merge B on A (shared adapter `context.ts`) → conformance client-IP parity scenarios.
4. Merge C, D, E in any order (disjoint) — each gated on its own package suite plus the
   `public-surface-lock` update for new exports.
5. Merge F last: boot audit, `security()` preset, fuzz + raw-socket suites, conformance security
   scenarios, migration guide, per-package README/ARCHITECTURE updates.
6. Flip D3 (`caseSensitive: true`) only in the major-release commit, with the route-casing diagnostic.

**Rollback:** each workstream is an independently revertible merge. B is revertible without A; A is not
revertible after B without also reverting B (shared file) — recorded here so the integrator does not
discover it during an incident.

## Open Questions

- Does D3 (`caseSensitive: true`) ship in this change, or in the next major with the RFC pre-approved?
  Decided by the release lane at execution time; `tasks.md` gates it.
- Should `secure: 'auto'` consult a forwarded-protocol header at all when a trust specification is
  configured, or always require TLS at the process? The spec currently fails closed (emit `Secure`)
  when the header is untrusted; whether a *trusted* `X-Forwarded-Proto: http` should suppress `Secure`
  is unresolved.
- Does the raw-socket malformed-request suite belong in `adapters/node` or in a new
  `adapters/conformance` tier? It is Node-transport-specific today but the same assertions apply to any
  future server adapter.
- Is `acceptLegacySignatures`'s removal target a minor or the following major?

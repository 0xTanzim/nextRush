# Wave A2 — Tier-2 middleware/extension/stream packages (19)

- **Track:** A (package docs)
- **Status:** ✅ **WAVE A2 COMPLETE (all 19/19 packages) — 2026-07-22.** History: batch 1 (cors, helmet,
  body-parser, validation), batch 2 (csrf, rate-limit, cookies, compression), batch 3 (multipart, static,
  template), batch 4 (logger, request-id, timer, health), batch 5 (openapi, events, websocket, stream —
  see below for this batch's findings). **Path correction:** middleware packages live under
  `packages/middleware/<name>/`, not `packages/<name>/`. **Recovered from 2 transient connection
  timeouts** (infra, not logic — per §11, work already on disk was verified rather than blindly redone).

### Work items (batch 1 — COMPLETE)
| Package | Source of truth | Notable facts | README | ARCH | Done |
| ------- | --------------- | -------------- | :----: | :--: | :--: |
| `cors` | `packages/middleware/cors/src` | wildcard+credentials rejection genuinely enforced (presets.ts) | ✅ | ✅ | ✅ |
| `helmet` | `packages/middleware/helmet/src` | CSP/HSTS/etc headers verified against constants.ts | ✅ | ✅ | ✅ |
| `body-parser` | `packages/middleware/body-parser/src` | 3-stage size-limit enforcement, prototype-pollution guard | ✅ | ✅ | ✅ |
| `validation` | `packages/middleware/validation/src` | Zod-only tested; Valibot/ArkType structurally compatible, not tested | ✅ | ✅ | ✅ |
- **Depends on:** task 0.6 (frozen templates) ✅ · Wave A1 ✅ — unblocked
- **Gate:** Validator per-package (independent context)
- **tasks.md item:** §4

### Objective (measurable)
All 19 Tier-2 packages have a `README.md` + `ARCHITECTURE.md` from the frozen templates, Tier-2 depth
(problem → default behavior → install → usage → options → integration → troubleshooting), source-verified.

### Scope
- **In scope:** `packages/middleware/{cors,helmet,csrf,body-parser,multipart,rate-limit,compression,
  cookies,validation,logger,static,template,openapi,request-id,timer,health}/`, `packages/extensions/
  {events,websocket}/`, `packages/stream/` (`README.md` + `ARCHITECTURE.md` each — create if missing,
  re-align to frozen template if present). **Note:** middleware packages live under `packages/middleware/`,
  not `packages/<name>/` directly — verify the real path before dispatching (this brief's first draft
  had it wrong; corrected 2026-07-21).
- **Forbidden:** Tier-1/3 packages, docs-site MDX, `src/` code.

### Templates & standards
Same as A1: `docs/templates/package-{readme,architecture}.template.md`; Tier-2 depth per
`documentation.instructions.md`. **Diagrams (EDS-012):** sequence for request-touching middleware
(before/after `ctx.next()`), state for anything with a lifecycle (rate-limit windows, csrf token
lifecycle), block-beta for package position — NOT basic flowcharts. README ASCII-only.

### Work items (batch 2 — COMPLETE)
| Package | Source of truth | Notable facts | README | ARCH | Done |
| ------- | --------------- | -------------- | :----: | :--: | :--: |
| `csrf` | `packages/middleware/csrf/src` | encoded-token pattern (`len!sessionId!len!randomHex`), not a generic double-submit-cookie | ✅ | ✅ | ✅ |
| `rate-limit` | `packages/middleware/rate-limit/src` | 3 real algorithms (token-bucket default, sliding-window, fixed-window); pluggable store, in-memory only bundled | ✅ | ✅ | ✅ |
| `cookies` | `packages/middleware/cookies/src` | HMAC-SHA256 signing (integrity only, NOT encryption); async signed-cookie set, sync delete | ✅ | ✅ | ✅ |
| `compression` | `packages/middleware/compression/src` | 3 real algorithms (gzip/deflate/br); **real bug found**: Brotli capability flag hardcoded true on Bun with no actual probe, silently fails-safe via degrade path | ✅ | ✅ | ✅ |

**Heal loop caught real defects in 3 of 4 packages:** cookies (2 rounds of LOC/file-count fabrication,
fixed via `wc -l` measurement); compression (a genuine undocumented Bun/Brotli capability-detection
bug — logged as an engineering finding, not just a doc fix); rate-limit (header-semantics mismatch:
`RateLimit-Reset`=delta-seconds vs `X-RateLimit-Reset`=absolute-timestamp, different units; one missing
proxy-header entry). csrf and rate-limit's algorithm/pattern claims were independently confirmed correct
on first pass.

**Engineering finding for maintainer follow-up (NOT a docs issue — a real code bug):** `packages/
middleware/compression/src/compressor.ts`'s `detectCapabilities()` hardcodes `hasBrotli: true`
unconditionally for Bun (`process.versions.bun` check) with no actual `CompressionStream` feature
probe, and never sets `hasNodeZlib: true` on Bun either — so a negotiated `'br'` encoding on Bun always
hits an unreachable implementation branch and throws. The middleware's degrade-to-uncompressed path
catches it, so it fails safe, but the capability flag itself is wrong and silently defeats Brotli on
Bun. Documented honestly in both docs (Compatibility table, Troubleshooting, a new `NoImplementation`
state in the state diagram) — but the underlying code should be fixed in a future engineering pass.

### Mandatory context
- Skill router + EDS-010/012/013, both package templates.
- Exemplar bar: `packages/errors/{README,ARCHITECTURE}.md` (Tier-1, but same structural rigor).
- Security boundaries (project-rules.instructions.md §4) apply directly to cors/helmet/csrf docs —
  verify defaults match (no wildcard CORS in prod, etc.) rather than asserting from memory.

### Done-condition & Validator checklist
- [ ] Both files exist per package, frozen sections present, no placeholders.
- [ ] Every option/default/behavior claim re-derived from `src/` — zero fabricated claims (A1/B1
  found 5 real fabrications via the heal loop — same scrutiny applies here).
- [ ] Diagrams precise/modern (EDS-012); README ASCII-only.
- [ ] Terminology + no forbidden words.

### Work items (batch 3 — COMPLETE)
| Package | Source of truth | Notable facts | README | ARCH | Done |
| ------- | --------------- | -------------- | :----: | :--: | :--: |
| `multipart` | `packages/middleware/multipart/src` | collect-then-parse (buffers whole body, NOT true wire-streaming); DiskStorage path check is a bare `startsWith` (narrower than static's), Node-only | ✅ | ✅ | ✅ |
| `static` | `packages/middleware/static/src` | two independent traversal layers (early reject + `root+sep` containment), weak ETag (FNV-1a), single-range only, Node-only | ✅ | ✅ | ✅ |
| `template` | `packages/middleware/template/src` | **6 real engines** (builtin + ejs/handlebars/nunjucks/pug/eta, all lazy-loaded optional peers) — implementer found 2 more than the brief named; only builtin is integration-tested | ✅ | ✅ | ✅ |

**Engineering findings logged (documentation is honest about them, not silently patched):**
- `multipart`'s `DiskStorage` traversal check (`resolved.startsWith(this.dest)`) is a real, narrower sibling-directory-prefix risk vs `static`'s stricter `root+sep`/exact-equality check — documented as a contrast, with a suggested tighter check for a future code pass.
- `template`'s only integration-tested engine is `builtin`; the 5 external adapters are "structurally-integrated, not integration-tested" (same overclaim risk pattern as batch-1's validation/Zod finding — caught proactively this time, not via heal loop).
- File-size violations flagged honestly in the docs themselves (not hidden): `multipart/parser.ts` (520), `static/{index,utils}.ts` (313/348), `template/{compiler,helpers,parser}.ts` (845/809/651) all exceed the 300-line middleware cap — pre-existing code debt, out of scope for this docs wave, logged for a future refactor pass.

### Work items (batch 4 — COMPLETE)
| Package | Source of truth | Notable facts | README | ARCH | Done |
| ------- | --------------- | -------------- | :----: | :--: | :--: |
| `logger` | `packages/middleware/logger/src` | thin wrapper re-exporting `@nextrush/log@0.2.1` (external pkg); real redaction (~60 sensitive keys + pattern-based), on by default in production only | ✅ | ✅ | ✅ |
| `request-id` | `packages/middleware/request-id/src` | secure-by-default (`trustIncoming: false`), UUID v4; downstream propagation is caller's responsibility (documented honestly, not overclaimed) | ✅ | ✅ | ✅ |
| `timer` | `packages/middleware/timer/src` | 4 middleware variants sharing one measure-in-finally shape; Server-Timing appends, doesn't dedupe | ✅ | ✅ | ✅ |
| `health` | `packages/middleware/health/src` | `/livez` unconditional 200 (never reads checks); `/readyz` has NO persisted/cached state — recomputes every request from a live check Map. Was already correct pre-batch — no fix needed. | ✅ | ✅ | ✅ |

**Real finding for a maintainer decision (logged, NOT silently resolved):** `@nextrush/logger` depends
on the external `@nextrush/log@0.2.1` package. `project-rules.instructions.md` §6's zero-dependency rule
lists only `reflect-metadata`, `tsyringe`, `@clack/prompts` as approved runtime-dependency exceptions
for core/router/errors/types/adapters/**middleware** packages — `@nextrush/log` is not on that list.
Either this is an undocumented approved exception (steering needs updating) or a real policy violation
(the dependency needs removing/justifying). The docs disclose the dependency honestly either way — this
is a steering/policy gap, not a documentation defect.

### Work items (batch 5 — FINAL, Wave A2 COMPLETE)
| Package | Source of truth | Notable facts | README | ARCH | Done |
| ------- | --------------- | -------------- | :----: | :--: | :--: |
| `openapi` | `packages/middleware/openapi/src` | dogfoods the same `generateDocument()` this session's `apps/docs/scripts/generate-openapi.ts` uses; no fabrications found on first pass | ✅ | ✅ | ✅ |
| `events` | `packages/extensions/events/src` | correctly an Extension (not middleware); heal loop caught a Bun/Deno/Edge cross-runtime overclaim (no conformance test exists) and an Extension-interface misattribution, both fixed | ✅ | ✅ | ✅ |
| `websocket` | `packages/extensions/websocket/src` | **Node-only** (implementer correctly overrode the brief's wrong Extension-framing assumption — it's a factory+middleware pair, not an Extension); **real dead-code bug found**: `clientTimeout` option declared+defaulted+tested but never read anywhere in `server.ts` — heartbeat interval alone drives termination | ✅ | ✅ | ✅ |
| `stream` | `packages/stream/src` | **3 rounds of real defects caught**: fabricated `consume()` method + invented type union, broken duplicated table header, and (most importantly) complete template-shape non-conformance — missing Identity/Highlights/TOC/At-a-glance/Responsibilities/6 more frozen sections. Also a fabricated citation (`v3-testing.instructions.md` doesn't exist). All fixed; independently re-verified: 0 mermaid-in-README, 0 non-ASCII, all frozen sections present. | ✅ | ✅ | ✅ |

**🎯 WAVE A2 COMPLETE — all 19/19 Tier-2 packages done, independently validated, 2026-07-22.**

**Engineering findings logged for maintainer follow-up (NOT silently patched — real code, not doc, issues):**
- `compression` (batch 2): Brotli capability flag hardcoded true on Bun with no real feature probe (fails safe, but wrong).
- `websocket` (this batch): `clientTimeout` option is dead code — declared, defaulted, tested, never read.
- `logger` (batch 4): depends on external `@nextrush/log`, not on the approved zero-dependency exception list in `project-rules.instructions.md` §6 — needs a maintainer decision (undocumented exception vs. real violation).

**Process lesson for future waves (logged for §12/retrospective):** the `stream` node shows that **"content is factually accurate" and "template-shape conformant" are two different checks** — earlier passes verified facts against source but didn't check structural completeness against the frozen template, and a defect slipped through 2 rounds before a validator explicitly diffed headings against a sibling exemplar. Future validator prompts should always include an explicit heading-list diff against the frozen template, not just a factual spot-check.

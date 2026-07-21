# Wave A2 — Tier-2 middleware/extension/stream packages (19)

- **Track:** A (package docs)
- **Status:** batch 1 COMPLETE — cors, helmet, body-parser, validation all done + independently validated, 2026-07-21. **Path correction:** middleware packages live under `packages/middleware/<name>/`, not `packages/<name>/` — brief corrected. **Recovered from 2 transient connection timeouts mid-batch** (infra, not logic — per §11, work already on disk was verified rather than blindly redone). **Real finding caught by the loop:** `validation`'s docs originally overclaimed equal Zod/Valibot/ArkType support; only Zod is an actual dependency/tested — fixed to distinguish "structurally compatible" (any Standard Schema v1 impl) from "integration-tested" (Zod only). cors' production-wildcard-safety claim independently confirmed genuinely enforced in `presets.ts`/`security.ts` (not just asserted).

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

**Remaining:** 8 of 19 A2 packages — logger/request-id/timer/health (observability); openapi (API&docs);
events/websocket/stream (extensions/streaming).

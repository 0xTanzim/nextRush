## Why

`harden-security-boundaries` resolved 19 findings from `report/security-review.md`, but that
review's own proposal explicitly scoped out a named list of surface it never touched: Node request
parsing beyond the new raw-socket malformed-request suite, `multipart/parser.ts` + `scanner.ts` +
`storage/`, `body-parser/json.ts` charset handling, `@nextrush/template` auto-escaping (a
first-order XSS surface), `class` guards/interceptors, and `websocket`/`stream`/`openapi`/`logger`.
"Security review complete" is not a claim `harden-security-boundaries` can make on its own —
`docs/audits/03-gap-checklist.md`'s T064 (a broader, still-`Not Started` dedicated security audit)
covers some of the same ground but at a different altitude (threat model, ReDoS,
prototype-pollution, dependency CVEs) and does not itself enumerate this specific package list.
This change exists to close that gap before either report is treated as exhaustive.

## What Changes

- Produce a point-in-time security review (`report/`, following `report/TEMPLATE.md` and
  `~/.kiro/steering/architecture-review.md`'s structure) of exactly the surface named above:
  - Node's own raw HTTP request-parsing path in `@nextrush/adapter-node` beyond what the new
    `raw-socket-malformed-request.test.ts` suite (added by `harden-security-boundaries` WS-F)
    already covers — header-block parsing, chunked-encoding edge cases, keep-alive reuse.
  - `@nextrush/multipart`'s `parser.ts`, `scanner.ts`, and `storage/` — boundary parsing, part-size
    limits, temp-file handling, path traversal via a crafted `filename` field.
  - `@nextrush/body-parser`'s `json.ts` charset handling — non-UTF-8 charset declarations, BOM
    handling, and any prototype-pollution vector in the JSON-reviver path.
  - `@nextrush/template`'s auto-escaping default and escape-bypass surface — the review's own
    "first-order XSS surface" framing from `harden-security-boundaries`'s proposal.
  - `@nextrush/class`'s guards and interceptors — authorization-decision ordering, whether a
    guard's rejection can be bypassed by interceptor ordering or an uncaught async rejection.
  - `@nextrush/websocket`, `@nextrush/stream`, `@nextrush/openapi`, `@nextrush/logger` — a lighter
    first-pass sweep for the same class of finding this review keeps finding elsewhere (a security
    decision made from an attacker-controlled or wrongly-normalized value).
- Every finding gets a severity tag (P1–P4, same scale as `security-review.md`), a requirement
  delta against `security-boundaries` where the finding extends that capability's scope, and a
  task in a new `report/security-review-remediation-index.md`-style index — or, for this specific
  change, an appendix table in the same style, to keep one canonical findings-to-fix mapping rather
  than starting a third parallel tracking document.
- No implementation work is scoped into this change's own `tasks.md` beyond the investigation and
  report — remediation of whatever is found becomes its own follow-up change (or changes), exactly
  as `harden-security-boundaries` did for this surface. Investigation and remediation are kept
  separate so the audit isn't rushed to also fix what it finds.

## Capabilities

### New Capabilities

None. This change produces a report and, where a genuine requirement gap is found, a delta against
an existing capability — it does not introduce a new durable capability of its own.

### Modified Capabilities

- `security-boundaries`: potentially extended with new requirements if this review finds a genuine
  gap in the multipart/body-parser/template/class/websocket/stream/openapi/logger surface that
  belongs under the same capability `harden-security-boundaries` established. Left empty at
  proposal time — the actual delta (if any) is written after the investigation, once real findings
  exist to ground it, per this repo's rule against speculative spec deltas.

## Impact

- **Affected code (read-only during investigation):** `packages/adapters/node/src` (request
  parsing), `packages/middleware/multipart/src/{parser,scanner}.ts` + `src/storage/`,
  `packages/middleware/body-parser/src/json.ts`, `packages/middleware/template/src`,
  `packages/class/src/{guards,interceptors}`, `packages/extensions/{websocket,stream}/src` (note:
  `@nextrush/stream` per `architecture.instructions.md` is `packages/stream`, not under
  `extensions/` — verify the real path before starting, steering can drift from source),
  `packages/middleware/openapi/src`, `packages/middleware/logger/src`.
- **Affected docs:** a new `report/` file; a possible new appendix or a link from
  `report/security-review-remediation-index.md` back to this change's own findings table (kept
  separate, not merged into the WS-A–F index, since that index's own task 9.7 already asserts
  completeness for exactly SEC-01…SEC-19 and should not be reopened by a different change's
  findings landing under the same numbers).
- **No runtime behavior changes** from this change itself — it is read-only investigation plus a
  written report. Any behavior change is a separate, future remediation change.

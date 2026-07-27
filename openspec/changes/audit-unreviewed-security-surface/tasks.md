## 1. Node request parsing (beyond the raw-socket suite already added by `harden-security-boundaries`)

- [ ] 1.1 Read `packages/adapters/node/src`'s header-block parsing path; confirm what the new `raw-socket-malformed-request.test.ts` suite (WS-F) already covers vs. what it does not (chunked-encoding trailers, keep-alive connection reuse across malformed requests, pipelined requests).
- [ ] 1.2 Write and run tests for any gap found in 1.1; record pass/fail evidence in the report regardless of outcome.
- [ ] 1.3 Conclude with an explicit statement of what was checked and what remains unchecked (e.g. HTTP/2 framing, if in scope for this adapter).

## 2. `@nextrush/multipart`

- [ ] 2.1 Read `parser.ts` and `scanner.ts`: boundary-string parsing, part-header parsing, and whether a crafted boundary or header can cause unbounded backtracking (ReDoS) or a part-count/size limit bypass.
- [ ] 2.2 Read `storage/`: temp-file naming and path construction — specifically whether a crafted `filename` field in a multipart part can escape the configured storage root (path traversal), and whether temp files are cleaned up on an aborted/errored upload.
- [ ] 2.3 Write and run tests for any gap found; record evidence either way.

## 3. `@nextrush/body-parser` JSON charset handling

- [ ] 3.1 Read `json.ts`'s charset resolution: what happens on a `Content-Type: application/json; charset=<non-utf-8>` header, on a UTF-8 BOM, and on a mismatched declared-vs-actual encoding.
- [ ] 3.2 Check for a prototype-pollution vector in the parse path (a `__proto__`/`constructor.prototype` key in the JSON body reaching `Object.prototype`).
- [ ] 3.3 Write and run tests for any gap found; record evidence either way.

## 4. `@nextrush/template` auto-escaping

- [ ] 4.1 Confirm the actual default: does template output auto-escape HTML-significant characters, and can a template author opt out per-value or only per-template.
- [ ] 4.2 Test the escape path directly against the classic XSS vectors (`<script>`, an `onerror` attribute value, a `javascript:` URL in an href-bound value) to confirm escaping is real, not merely documented.
- [ ] 4.3 Write and run tests for any gap found; record evidence either way — this is the area design.md flags as most likely to surface a P1/P2 finding, so a clean result needs the strongest evidence citation of any area in this change.

## 5. `@nextrush/class` guards and interceptors

- [ ] 5.1 Read the guard-execution order relative to interceptors and route-handler invocation: confirm a guard's rejection cannot be bypassed by interceptor ordering, and that an uncaught async rejection inside a guard fails closed (denies) rather than failing open (allows).
- [ ] 5.2 Write and run tests for any gap found; record evidence either way.

## 6. `websocket` / `stream` / `openapi` / `logger` — lighter first-pass sweep

- [ ] 6.1 For each of the four packages, spend a bounded pass looking specifically for the recurring finding class this whole review keeps surfacing: a security-relevant decision made from an attacker-controlled or wrongly-normalized value (e.g. does `@nextrush/websocket` validate `Origin` on the upgrade request the same way `@nextrush/cors` now does post-SEC-10; does `@nextrush/logger` ever log a raw header value that could contain a CRLF injection; does `@nextrush/openapi`'s generated spec ever leak an internal path).
- [ ] 6.2 Write and run tests for any gap found; record evidence either way per package.

## 7. Report and handoff

- [ ] 7.1 Write the point-in-time report at `report/<descriptive-name>.md` per `report/TEMPLATE.md` and `~/.kiro/steering/architecture-review.md`'s structure (Executive Summary → System Understanding → findings, each with Current Situation/Impact/Benefits/Drawbacks/Long-Term Risk/Recommendation/Tradeoffs/Priority/Migration Difficulty).
- [ ] 7.2 Include a findings-to-fix table in this report (not merged into `security-review-remediation-index.md`, per design.md's decision) covering every finding from §1-6 with severity, evidence, and a pointer to whichever future change should remediate it.
- [ ] 7.3 Cross-link this report from `docs/audits/03-gap-checklist.md`'s T064 entry (mirroring the cross-link `harden-security-boundaries` §9.6 already added there for `security-review.md`) so a future T064 pass finds this work without re-deriving it.
- [ ] 7.4 If any finding produces a genuine `security-boundaries` requirement delta, replace this change's placeholder `specs/security-boundaries/spec.md` scenario-only delta with the real one before archiving — do not archive a change whose spec delta doesn't reflect what was actually found.

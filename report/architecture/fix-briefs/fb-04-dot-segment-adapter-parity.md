# FB-04 — Dot-segment rejection (RFC-029) only works on Node; Web adapters never see raw targets

| Field | Value |
| --- | --- |
| **Severity / Priority** | Medium · P1 (security-control parity) |
| **Area** | `@nextrush/runtime` (`web-context-base.ts`, capabilities), `@nextrush/router` (`canonicalize.ts`), conformance, docs |
| **Depends on** | — (pairs well with FB-07: removes `new URL` from the hot path) |
| **RFC-gated** | No (restores RFC-029's stated guarantee; platform limits are documented, not designed away) |
| **Size** | M |
| **Probe ids** | `dot-segment-literal`, `dot-segment-encoded` (`knownFailures: FB-04`) |

## Finding

- **Current situation (measured):**

  | Request target | Node adapter | Bun adapter |
  | --- | --- | --- |
  | `/files/../admin` | **400** (rejected) | **200** — served as `/admin` |
  | `/files/%2e%2e/admin` | **200** (wildcard match, param `../admin`) — not rejected | **200** — served as `/admin` |

  Deno's `request.url` keeps the raw target (`/files/../admin`, verified), but NextRush still normalises it (below), so Deno behaves like Bun.
- **Root cause (two separate gaps):**
  1. `packages/runtime/src/web-context-base.ts:171-173` — `new URL(request.url).pathname` applies WHATWG dot-segment resolution, so `ctx.path` never contains `..` on **any** Web adapter (Bun, Deno, Edge, serverless). RFC-029's rejection in `router/src/canonicalize.ts:48-65` can only fire on Node (raw `req.url`).
  2. `hasDotSegment` (`canonicalize.ts:48`) matches only literal `.`/`..`; percent-encoded dots (`%2e`, `%2E`, `.%2e`, `%2e%2e`) are accepted everywhere.
- **Impact:** RFC-029's goal is to avoid a path desync with a front proxy (resolve vs reject). On Web adapters the app resolves locally: a proxy ACL that blocks `/admin` can be bypassed with `/files/../admin` and the framework serves `/admin`. The "identical behaviour on every runtime" promise (ADR-0010) is false for this security control, and the conformance suite (in-process requests) cannot see it.
- **Benefits of today's design:** Web platforms normalise for you; fewer raw-target edge cases in handlers.
- **Drawbacks:** Platform normalisation is invisible to the app and differs per runtime.
- **Long-term risk:** More Web-based hosts (Workers, Vercel Edge) normalise before the app runs; the guarantee can never be uniform. It must be documented as a capability, not promised.
- **Recommendation:** (1) Use the raw request target wherever the platform keeps it (Deno, and Node already). (2) Reject encoded dot segments too. (3) Record the platform limit as a capability (`rawRequestTarget`) and document it. (4) Test it with a real socket per adapter.
- **Trade-offs:** Slicing the raw URL string must handle odd absolute forms; it also removes a `new URL` allocation per request (≈ 0.15 µs).
- **Migration difficulty:** Moderate (behaviour change on Deno/Node for encoded dots).

## Reproduce

```bash
node apps/benchmark/scripts/dev-check/check.mjs probe --rt node   # FAIL/KNOWN dot-segment-encoded status=200
node apps/benchmark/scripts/dev-check/check.mjs probe --rt bun    # passes today only because Bun is expected to be 200|400 (documented divergence)
```

## Fix — step by step

1. **Raw path helper** in `@nextrush/runtime`: `rawPathFromUrl(url: string): { path: string; search: string }` — find `://`, the next `/` (else `/`), then split at the first `?` / `#`. No `new URL`. `WebContextBase` uses it for `path`, `url`, `originalPath`, and `parseQueryString(search)`. Unit-test odd inputs (no path, IPv6 host, `?` only, `#` fragments, very long targets).
2. **Encoded dot segments** in `hasDotSegment` (keep it a single linear scan, no regex): a segment counts as a dot segment when, after replacing `%2e`/`%2E` with `.`, it is exactly `.` or `..`. Cheap check first: only inspect segments of length ≤ 6 that start with `.` or `%`.
3. **Capability:** add `rawRequestTarget: boolean` to the runtime capabilities (`packages/runtime/src/detection.ts` / types). Node = `true`; Deno = `true`; Bun = `false` (Request.url pre-normalised, verified: `/a/%2e%2e/b` → `/b`); Edge/serverless = `false`. No runtime-identity branches in behaviour — the capability only drives docs and conformance expectations.
4. **Conformance:** extend `packages/adapters/conformance` with a **real-socket** dot-segment scenario (in-process `Request` construction cannot see this): expectation table `rawRequestTarget ? 400 : [200, 400]`.
5. **Docs:** security guide + each adapter page: "Bun and Workers-style runtimes normalise dot segments before NextRush sees the path. Enforce path ACLs in the app (after normalisation) or make sure your proxy normalises identically. NextRush rejects dot segments only where the platform preserves the raw target."
6. Update `apps/benchmark/scripts/dev-check/lib` probe expectations: `rt` of `node` **and** `deno` expect `400` for both literal and encoded; `bun` expects `200|400`. (Add a Deno stage when RFC-040 P3 lands.)

## Tests first

- `packages/router/src/__tests__/canonicalize.test.ts`: `/a/%2e%2e/b`, `/a/%2E./b`, `/a/.%2e/b`, `/a/%2e/b` → `rejected`; `/a/%2ehidden`, `/archive.tar.gz`, `/a/..hidden`, `/a/%252e%252e/b` (double-encoded) → **not** rejected.
- `packages/runtime/src/__tests__/web-context-base.test.ts`: `ctx.path` equals the raw path for `https://h/a/../b?x=1` (when `request.url` is that string) and `originalPath` the same.
- Conformance real-socket scenario (step 4) on node and deno; bun/edge assert the documented divergence.

## Acceptance criteria

- [ ] New tests fail before, pass after.
- [ ] `check.mjs probe --rt node`: both dot-segment probes PASS with `400`; `--rt bun` still passes.
- [ ] `FB-04` removed from `knownFailures`.
- [ ] `check.mjs inproc` improves or is flat (no `new URL` per request).
- [ ] Security docs and adapter docs updated; CHANGELOG notes the encoded-dot rejection.
- [ ] `pnpm --filter @nextrush/runtime --filter @nextrush/router test`, conformance, typecheck, lint green.

## Do NOT

- Do not resolve dot segments locally "to be helpful" — RFC-029 rejects, never resolves.
- Do not add `if (runtime === 'bun')` branches; use the capability.
- Do not decode `%2f`/`%5c` here (out of scope; track as a follow-up check).

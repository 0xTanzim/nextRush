# RFC 018 — Response serialization strategy for the POST/JSON hot path

- **Status:** Proposed
- **Area:** request-data
- **Related change:** `openspec/changes/request-response-hotpath-round2` (T3b)
- **Capabilities touched (if accepted):** `node-adapter`, `web-adapters`, possibly a new
  `response-serialization` capability
- **Supersedes / relates:** RFC 017 (BodySource limit propagation); the
  `request-response-hotpath-round2` change (T2/BP-K, T3a)

## Summary

Evaluate whether an **opt-in, schema-compiled response serializer** for `ctx.json` (the
`fast-json-stringify` equivalent) is worth adding as the remaining lever to close NextRush's
POST/JSON gap to raw Node. **Recommendation: do NOT pursue a compiled serializer at this time.**
A measurement spike shows a *correct* (string-escaping) in-house compiled serializer is **slower**
than V8's native `JSON.stringify` for NextRush's response shapes; only an unsafe, non-escaping
variant is faster, and that is not shippable. This RFC records the evidence so the idea is closed
with data rather than re-proposed on folklore.

## Motivation

The `request-response-hotpath-round2` design attributed the residual ~23% POST-vs-raw gap partly to
response encoding, on the widely-repeated premise that `fast-json-stringify` (schema-compiled) is a
large win over `JSON.stringify` — the mechanism behind Fastify's POST edge. Before adding a public
API and a new dependency/capability for it, T3b required a spike to **size the actual win** on the
shapes NextRush returns.

## Spike results (evidence)

Microbench (`/tmp/t3b-serialize-spike.mjs`, Node ≥22, 2M iterations × 6 trials, median), comparing
`JSON.stringify` against a hand-"compiled" serializer for representative API response shapes:

| Response shape | `JSON.stringify` | Compiled (escape-correct) | Ratio |
| -------------- | ---------------- | ------------------------- | ----- |
| single object (`{id,name,email,active}`) | 6.34 M/s | 4.77 M/s | **0.75× (slower)** |
| list of 20 objects | 0.50 M/s | 0.36 M/s | **0.72× (slower)** |
| single object (naive, **no string escaping** — unsafe) | 6.69 M/s | 14.53 M/s | 2.17× (faster) |

**Interpretation:**

- A serializer that escapes string values correctly (mandatory — a name containing `"` or a control
  character must not break the JSON or open an injection) does so by calling `JSON.stringify` per
  string field plus manual concatenation. That is **more** work than one native `JSON.stringify`
  over the whole object: modern V8's `JSON.stringify` is a highly optimized C++ path that a
  pure-JS concat-and-escape loop does not beat.
- Only the **unsafe** variant (raw `'"' + value + '"'`, no escaping) wins — and it is not
  shippable: it corrupts output and is an injection vector on any user-controlled string.
- `fast-json-stringify`'s real-world edge over *modern* V8 is therefore small and highly
  shape-dependent (its historical wins were largely against older V8), and it can be slower; its
  advantage relies on schema-declared "safe" fields skipping escaping — precisely the unsafe path,
  restricted to fields the developer has guaranteed safe.

## Options considered

1. **In-house schema→serializer compiler (zero-dep).** Rejected by the spike: an escape-correct
   in-house compiler is slower than `JSON.stringify`. Not worth the code, the public schema API, or
   the maintenance.
2. **Reuse the Standard Schema integration (`@nextrush/validation`) to derive a serializer.** Same
   escaping wall as (1); a Standard Schema doesn't make per-field escaping cheaper. Adds coupling
   for no measured win.
3. **Optional `@nextrush/serializer` package wrapping `fast-json-stringify`.** Keeps core zero-dep,
   but the spike says the expected win on our shapes is near-parity-to-negative for safe output.
   Adds a dependency, a public schema-registration API (§5 "Public API Is Sacred"), and cross-adapter
   surface for a benefit not demonstrated. Not justified now.
4. **Do nothing (recommended).** Keep `ctx.json` → `JSON.stringify`. Re-attribute the POST gap to
   the async read/response layering (partly addressed by T3a) and the irreducible socket +
   `JSON.parse` cost, not to response encoding.

## Decision

**Deferred / not pursued.** No compiled-serializer code, public schema API, dependency, or
`response-serialization` capability is created. `ctx.json` continues to use `JSON.stringify`.

Re-open only if a future spike demonstrates a **safe** serialization path with a **measured** win
(> benchmark noise) on real NextRush response shapes — for example:

- static/precompiled response **templates** for fixed-shape hot routes (build a template once,
  splice escaped dynamic values), measured against `JSON.stringify`;
- targeting numeric/boolean-heavy payloads where escaping is not needed;
- a future V8 API for faster schema-guided serialization.

Any such path is a new RFC with its own spike, not an amendment here.

## Constraints (recorded for any future attempt)

- **Zero-dep core** (`AGENTS.md` §6): a serializer dependency lives in an optional package, never in
  `core`/adapters.
- **Correctness first** (§ engineering-standards, security): never ship unescaped string
  concatenation; escaping is not optional.
- **Measure before optimizing** (`AGENTS.md` §11): this RFC exists because the premise was measured
  and did not hold. The same bar applies to any revival.

## Testing / validation

The spike script (`/tmp/t3b-serialize-spike.mjs`) is the artifact; it is disposable (not committed
to the package) — its numbers are captured in this RFC. No production code changed under this RFC.

## Why

Every NextRush package is ESM-only today — no package's `exports` map declares a `require` condition — but this had never been an **explicit, documented decision** before this change. It was a default that fell out of the toolchain, not a stated policy. Because v1.0 (gate task T060) freezes the packaging contract across ~35 packages, the framework needed a deliberate, published module-format policy *before* the freeze (gap-checklist T051; depends on the now-published version/support policy T007).

**This has been ratified as final: NextRush is ESM-only, permanently. Dual-publish (ESM+CJS) was evaluated and explicitly rejected (see design.md D2/D3) — not deferred, not "for now," not reopened without a new maintainer decision and a hard external forcing function.**

## What Changes

- **Ratified module-format decision: ESM-only, permanent.** Documented with rationale in the versioning/compatibility docs (building on T007). No packaging change — the current de facto state becomes an explicit, enforced, non-negotiable policy.
- **CommonJS is banned, not merely "not currently supported."** No package will ever gain a `require` condition in its `exports` map without a new OpenSpec change overturning this decision. The documentation states this plainly — no hedging language ("currently," "at this time," "may support later").
- **Interop path documented for CJS consumers:** dynamic `import()`, plus the Node ≥22.12 native `require(esm)` note for synchronous graphs (verified applicable — the core entry graph has no top-level `await`).
- **Enforced in CI, not left to convention:** a packaging-conformance check asserts every published package's `exports` has no `require` condition and every `package.json` is `type: module`. This check exists specifically so packaging cannot silently regress toward CJS.
- Non-breaking to current ESM consumers.

## Capabilities

### New Capabilities
- `module-format-policy`: an explicit, documented, and CI-enforced policy that NextRush is ESM-only — permanently — including the supported consumption methods and the interop guidance for CommonJS consumers.

### Modified Capabilities
<!-- None. No existing spec's requirements change. The policy interacts with public-surface-lock (T005) and the bundle budget (T012) but does not alter their requirements — noted as constraints in design.md. -->

## Impact

- **Decision + docs:** versioning/compatibility docs (the T007 artifacts) gain the stated policy and rationale, worded as a permanent architectural decision, not a revisitable default.
- **Enforcement:** a new CI/test check verifying no published package's `exports` map ever gains a `require` condition.
- **No packaging change.** ESM-only was already the actual state; this change makes it explicit, permanent, and enforced — it does not add or remove any build output.
- **Dependencies:** no new runtime dependency.
- **Dual-publish is not built and will not be built under this decision.** The prior draft's conditional dual-publish path (functional core dual-published, `class`/`di` kept ESM-only) is retired — kept in design.md only as a record of what was evaluated and rejected, struck through, not as a deferred TODO.

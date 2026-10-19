# AGENTS.md — NextRush

NextRush is a TypeScript-first, multi-runtime backend framework. Its goal: **developers write less code, configure less, and understand more, while the framework stays correct, portable, secure, and measurably fast.**

This is the root entry point for agents. It holds stable, project-wide rules. Detailed procedures live in skills, specs, RFCs, ADRs, templates, and scripts. Read only what the task needs. A nested `AGENTS.md` near the code you change takes precedence for that area.

---

## 1. Principles

**Developer experience is the product.**
- One obvious golden path, copy-paste-runnable, working out of the box.
- Convention over configuration. Never ask for information the framework can infer, detect, or standardize.
- Consistent, discoverable APIs with excellent autocomplete and a small learning curve.
- Errors teach: what happened, why, how to fix it. Development errors maximize clarity. Production errors prioritize stability and security.

**The framework owns complexity.** If the choice is more framework complexity or more application complexity, choose framework complexity. Internal sophistication, external simplicity.

**Public API is a long-term commitment.** Before exporting anything: does it belong in the public API, can users reach the goal without it, will it make sense in five years? A smaller surface makes a more stable framework.

**Hard gates.** Security, correctness, and compatibility are never traded for a performance result.

**Performance and clarity work together.** Optimize *inside* the framework, behind a plain public API, with proof (see §6). Never make the public API harder to use for a speed gain.

---

## 2. Orient before you act

1. Confirm repo root, branch, and any nested `AGENTS.md`.
2. Run `git status --short --branch` and read the relevant diff. The tree may contain the user's work. Preserve it.
3. Find the package manager from the lockfile. Read the relevant `package.json` scripts before choosing commands. Check runtime and tool versions when they affect results.
4. Read the implementation, tests, and entrypoints you will touch. Verify that paths, commands, indexes, baselines, and old audits are still current.
5. For non-trivial work, write the goal, constraints, acceptance criteria, and a small plan first.

Search with targeted queries, symbol navigation, or `codebase-memory-mcp`. Do not dump-read the repo. A partial or stale index is incomplete evidence.

---

## 3. Evidence rules

- Separate **observed behavior**, **source-confirmed facts**, **external claims**, and **hypotheses**. Label uncertainty.
- Code shows what happens now. Specs and tests show what is intended. When they disagree, record the mismatch and decide which one is authoritative for the task. The mismatch may be a bug in the code. Do not assume either side is right.
- Exception: governance and registry docs (`openspec/README.md`, `openspec/config.yaml`) follow the code. If they drift, fix the docs.
- Old reports and benchmark tables are leads, not proof. Re-run before making a current claim.
- Never invent paths, line numbers, test results, timings, versions, or benchmark outcomes. Give commands and source locations that others can reproduce.
- For ecosystem claims, check official docs, release notes, or source. Record the exact version and date. Mark prereleases.

---

## 4. Architecture and request flow

### Mental model

```
Runtime (Node / Bun / Deno / Workers / Vercel Edge / Lambda)
   │  native request
   ▼
Adapter      normalizes to Web Request/Response, advertises capabilities
   ▼
Core         creates context, owns lifecycle and error boundary
   ▼
Router       matches path (compiled once at startup) → handler + params
   ▼
Middleware   chain composed once at startup → handler
   ▼
Response     Web Response or ReadableStream
   ▼
Adapter      writes to the runtime (batched writes, backpressure)
```

This diagram is the intended model. If the code differs, the code wins: fix this section.

### Rules

- **Dependency direction:** adapters depend on core. `core`, `router`, and `middleware` never depend on an adapter. No cycles. Use the repo's boundary checks; if none exist, propose one.
- **One responsibility per component**, explicit boundaries, low coupling, high cohesion. Composition over inheritance. Understand the architecture before implementing.
- **Each package is an independent product:** one purpose, intentional dependencies, stable exports, tests, examples, docs. An optional feature or adapter must not leak into default entrypoints without a measured or documented reason.

### Runtime independence (mandatory)

The Web Platform is the foundation. Every runtime is an implementation detail behind an adapter.

- **Core imports no runtime API.** No `node:*`, `process`, `Buffer`, `Deno`, or `Bun` in `core`, `router`, or `middleware`. Use `Uint8Array`, `TextEncoder`/`TextDecoder`, and Web streams there.
- **Capabilities decide behavior, never runtime names.** No `if (runtime === 'x')` choosing what a feature does. A runtime-specific optimization is fine behind an adapter boundary if it keeps the documented contract.
- **Edge-first.** The request path uses only Web-standard `Request`, `Response`, `ReadableStream`, `AbortSignal`, `URL`, `crypto.subtle`. Node is the "extra capabilities" case.
- **Parity is proven.** Run the conformance suite (`packages/adapters/conformance`) on every runtime-touching change.
- **Do not promise what a runtime cannot provide.** Define the shared portable contract, test it on every supported runtime, and document capability differences or unsupported behavior.

A feature that works on one runtime and not another is not done.

---

## 5. Code quality bar

Internal code must be easier to maintain than application code. Reject bad code in review, including your own.

**Structure**
- Small modules and functions with one responsibility. Early returns, shallow nesting.
- No boolean-flag parameters. Use separate functions or a named options object.
- One implementation per contract. No duplication, no leaked internals.
- No circular imports. No barrel files with side effects.
- Add an abstraction only when its benefit and boundary are clear.

**Types (TypeScript)**
- `strict` on. No `any` in public types. Use `unknown` and narrow it.
- Prefer discriminated unions and `readonly`. No unchecked casts. No non-null assertion without a comment saying why it is safe.
- Type complexity is a cost: heavy generics slow the compiler and autocomplete. Measure with `tsc --extendedDiagnostics` when in doubt.

**State and errors**
- No module-level mutable state or hidden globals. No mutation of caller inputs.
- Ownership of buffers and request data is explicit.
- Never swallow errors. Errors are actionable (what, why, fix).

**Readability**
- Descriptive names. Named constants with units, not magic numbers.
- Comments explain *why*, not *what*. No dead code, no commented-out code, no TODO without an issue or RFC link.

---

## 6. Performance engineering (mechanical sympathy)

NextRush is TypeScript running on JIT engines (V8 in Node, Deno, Workers, and Edge; JavaScriptCore in Bun). We cannot touch CPU registers or cache lines directly. We **shape code so the JIT, the garbage collector, and the OS do the right thing**, and we **prove it with tools**. Engines and versions differ: a trick that helps V8 may do nothing on JavaScriptCore. Re-verify on every supported runtime.

### Systems-level reasoning (mandatory for performance work)

For any non-trivial performance-sensitive change, optimization, bottleneck investigation, or performance-related architecture decision, read the `systems-performance-engineering` skill before proceeding.

Trace the complete execution path and reason across algorithms, allocations and object lifetimes, garbage collection, JIT behavior, CPU execution, cache locality, virtual memory, scheduling, syscalls, and I/O as relevant.

Treat suspected costs as hypotheses, not facts. Identify unnecessary work, measure the actual bottleneck, and eliminate it at the highest architectural level possible. Preserve clean code, correctness, security, portability, and public API clarity.

Do not apply low-level optimization rules mechanically. Distinguish what the framework can control, what it can influence, and what it can only observe. Use the repository's profiling and audit procedures to validate changes with reproducible evidence.

### 6.1 Where to look first

Go top to bottom. Higher levels give bigger wins and cost less risk.

1. **Algorithm and data structure.** Per-request work should not grow with route count. Static routes: O(1) lookup. Dynamic routes: a compiled matcher.
2. **Do less work.** Precompute at startup (compile routes, compose middleware once). Parse lazily: headers, query, body, and cookies are parsed only when read.
3. **Allocation and GC pressure.**
4. **JIT friendliness:** shapes, monomorphism, element kinds, inlining.
5. **I/O and syscalls.**
6. **Hardware effects:** cache lines, pages. Optimize here only with counter evidence.

Think in a per-request budget. At 100,000 requests per second on one core, total time per request is about 10 µs. This is an illustration, not a target. Every microsecond on the hot path must justify itself.

### 6.2 What happens underneath, and our rules

| Layer | What happens underneath | Rule for our code | Verify with |
| --- | --- | --- | --- |
| Allocation and GC | In V8's young generation, allocating is cheap. The cost appears when objects survive (promotion to old space), are large, or are created faster than they can be collected. | No needless per-request closures, arrays, spreads, or temp objects on the hot path. Never let request data outlive the request. Pool objects only with profile proof and strict ownership. | `--trace-gc`, `--heap-prof`, allocations-per-request check |
| Object shapes | The JIT specializes property access to an object's hidden class using inline caches. One shape at a call site is fastest (monomorphic). A few is slower (polymorphic). Many falls back to generic lookup (megamorphic). | Create objects with the same fields in the same order. Initialize every field in the constructor or literal. No `delete`. No adding fields later. Keep hot call sites to one shape. | `--trace-opt`, `--trace-deopt`, CPU profile |
| Numbers and arrays | Small integers are stored unboxed; other numbers may need boxing. Arrays have element kinds (packed or holey; small-int, double, or generic) that only transition one way. | Keep hot arrays dense and single-typed. Use typed arrays (`Uint8Array`, `Uint32Array`) for bytes and numeric tables. Avoid holes. | micro-benchmark with realistic inputs |
| Registers and inlining | The optimizing JIT keeps values in CPU registers when functions are small, types are stable, and values do not escape. Escape analysis can remove short-lived objects entirely. | Small, single-purpose hot functions with stable argument and return types. No `arguments`, rest/spread, or mixed-type parameters on the hot path. | `--trace-deopt` (read the deopt reasons) |
| Strings and bytes | Concatenation builds ropes that are flattened later. Slicing, regex, and text-to-bytes conversion allocate or copy. | Scan paths with index loops and `charCodeAt`. No regex on the hot path without proof. Pass bytes as `Uint8Array` or streams without copying. Decode lazily. | CPU profile, allocation profile |
| Cache lines and locality | The CPU loads memory in cache lines (typically 64 bytes on x86-64; some ARM64 CPUs use 128). Pointer chasing causes cache misses. Contiguous data is prefetch-friendly. | Prefer flat, compact structures over deep object graphs for hot data (router nodes, header tables). Keep the working set small. With `SharedArrayBuffer` and `Atomics`, keep hot counters on separate cache lines to avoid false sharing. | `perf stat` (cache misses, IPC) on Linux |
| Pages and memory | The OS maps memory in pages (typically 4 KiB). First touch causes a page fault. Large working sets cause more TLB misses. Unbounded growth ends in OOM. | Bound every cache, queue, and buffer. Do not retain request objects in closures or module state. Reuse buffers only with clear ownership. Respect tight edge memory limits. | `--heap-prof`, RSS over a long load run |
| Syscalls and kernel | Each syscall crosses from user mode to the kernel and may copy data. The runtime waits for I/O through epoll, kqueue, or IOCP. Many small writes mean many syscalls and many small TCP packets. | One batched write per response (headers and body together, or `cork`/`writev` in the Node adapter). Stream with backpressure. No sync file or crypto work in the request path. | `strace -c`, `perf trace` (Linux) |
| Async and event loop | Every `async` call allocates a Promise. Every `await` costs a microtask turn, even when the value is ready. | Keep a synchronous fast path when nothing is async. Compose middleware once at startup, not per request. Never block the loop with CPU-heavy work. Offload it through a capability. | CPU profile, event-loop delay in the Node adapter |
| Startup and bundle | Module parsing, compilation, and graph size dominate cold starts on serverless and edge. | No top-level work. Lazy-load optional features. Tree-shakeable ESM, side-effect-free modules. | bundle-size check, cold-start measurement |

### 6.3 Contract for any optimization

An optimization is accepted only when it has all of these:

1. **Profile evidence** that the code is on the hot path, with its share of per-request cost. (Amdahl's law: a 30% win on code that is 2% of request cost is a 0.6% win.)
2. **Before and after numbers** from the same machine, runtime versions, and workload, with the run-to-run spread. The win must be larger than the noise.
3. **Equivalence tests.** The fast path is tested against a simple reference implementation (differential or property tests) plus edge cases: encoding, trailing slashes, params, case sensitivity, empty input.
4. **A fallback** to the general path when the fast path's preconditions fail. Both paths share one contract.
5. **Isolation and a "why" comment.** The fast path lives in a small, named function or module. The comment states why it exists and links the measurement. The public API does not change.
6. **A guardrail:** a benchmark or budget that catches regression.
7. **Cross-runtime check:** re-measured on every supported runtime, with no regression elsewhere.

### 6.4 Not allowed

- Speculative rewrites and micro-optimizations without a profile.
- `eval` or `new Function` in core. Edge runtimes such as Cloudflare Workers typically block them. Verify before relying on them anywhere, and gate behind a capability with a fallback.
- Engine-internal tricks (for example V8 natives syntax) in shipped code. They are for investigation only.
- Behavior that depends on runtime identity, or on one engine's quirks without detection and fallback.
- Object pooling, manual buffer reuse, or caches without a clear lifetime and size bound.
- Unreadable bit-twiddling or unrolled loops outside a proven hot path.
- Making the public API more complex for a performance gain.

---

## 7. Profiling playbook

Applies to profiling, benchmarking, bottleneck hunting, architecture audits, validating an audit or RFC, reproducing a performance claim, and comparing NextRush with Hono, Elysia, Fastify, Node, Bun, or a raw runtime.

### Setup
- Systems reasoning: Use `systems-performance-engineering` skill for the low-level cost model, bottleneck hypotheses, and optimization trade-offs.
- Use the **`framework-audit-profiling`** skill. Also use **`framework-profiling`** when it is newer or more specialized for the area. Find their real installed paths. If unavailable, say so and follow the repo's tools with the same evidence discipline.
- Inspect existing profiling scripts, benchmark entries, budgets, known failures, RFCs, and earlier audits before building new tooling.
- Read the relevant skill's SKILL.md before beginning its workflow. Find actual installed paths; never assume a skill exists or that its name guarantees activation.
- Inspect existing scripts, benchmark entries, budgets, known failures, RFCs, and previous audits before creating new tooling.


### Method

1. **Name the question and the layer.** In-process request cost, real HTTP throughput and latency, cold start, bundle size, memory and allocations, CPU attribution, or behavior. These are not interchangeable.
2. **Get a stable baseline.** Production build and mode (not dev). Fixed runtime and tool versions. Warm up until the JIT is stable. Run the load generator on separate cores from the server, and check that it is not the bottleneck. On Linux, fix CPU frequency scaling where possible. Repeat runs and report min, median, and max.
3. **Find where the time goes.** Start with a CPU profile and read it as a flame graph. Then check allocation and GC, then JIT health (deopt loops, megamorphic sites), then syscalls.
4. **Classify the bottleneck.** CPU-bound, memory-bound (low instructions-per-cycle, high cache misses), GC-bound, syscall or I/O-bound, or event-loop-blocked. Hardware counters may be unavailable in VMs and containers. Say so when they are.
5. **One change, then re-measure** under the same conditions. Keep only wins above noise. Revert the rest.
6. **Check end to end.** A micro-benchmark win that does not move the real HTTP result is not a win unless it is on the hot path and shown by the profile.
7. **Verify correctness.** Run tests and conformance. Record the finding and update budgets.

### Tools

Node: `--cpu-prof`, `--heap-prof`, `--trace-gc`, `--trace-opt`, `--trace-deopt`. Flame graphs can be read in Chrome DevTools or speedscope. Linux: `perf stat`, `perf record`, `strace -c`. Use the repo's existing load tool and benchmark harness before adding new ones. Flags change between versions: confirm with `node --v8-options` for the installed version. Bun and Deno have their own profilers: read their docs, do not assume Node flags work.

### Benchmark hygiene

- Compare equivalent workloads: runtime versions, machine, flags, warm-up, concurrency, payloads, middleware, tool versions. State mismatches and measurement limits.
- Consume benchmark results and vary inputs, so dead-code elimination and constant folding do not fake a win.
- Report latency percentiles (p50, p99, p99.9), not only throughput or the mean. State whether the load generator corrects for coordinated omission.
- The raw runtime is a contextual floor, not a feature-equivalent framework.
- Use fast feedback loops during development. Reserve long suites for release-quality confirmation.
- Measure before optimizing. Never sacrifice API clarity for an insignificant gain.

### Findings and audits

- A finding states: impact, source evidence, reproduction or measurement, counter-evidence, trade-offs, validation criterion, and a confidence rating.
- For an explicitly requested audit, create or update `.audit/` using the skill's templates. Never overwrite audit history or fabricate evidence.
- An audit is **read-only** unless implementation is explicitly requested. Do not change app code, CI budgets, dependency versions, lockfiles, or known-failure registries to make a check pass. Never loosen a budget or remove a known failure without evidence and a documented reason.

---

## 8. Tests and verification

1. Find the repo's real scripts and test conventions first. Run the narrowest reliable check before the broad ones.
2. Add or update tests for every behavior change, including failure cases and boundaries.
3. For adapter or runtime changes, run conformance on every affected supported runtime. One runtime's tests do not prove parity.
4. For public API or architecture changes, also check impacted package tests, type checks, examples, docs, lint, and build.
5. Support for any runtime, platform, or feature must be backed by automated tests: unit, integration, conformance, runtime-compat, and benchmarks where appropriate.
6. Report commands and real results. If a check cannot run, say why and what remains unverified. Never claim success before checking the result.

---

## 9. Compatibility surfaces

Public exports, routing semantics, middleware order, DI behavior, adapter contracts, and runtime support are compatibility surfaces.

Before changing one: read the applicable spec and RFC/ADR policy, confirm the change is necessary, evaluate migration cost, write migration guidance, and batch breaking changes into major releases.

---

## 10. Documentation

A feature is not done until it is documented. Outdated documentation is a bug. Examples are part of the public API.

**Every feature** documents: purpose, architecture, public API, examples, common use cases, limitations, trade-offs, troubleshooting, and migration notes when applicable. Docs teach concepts, not just list methods.

**Every public package** ships both:
- `README.md`: how to use it (npm landing page). ASCII-only, no Mermaid.
- `ARCHITECTURE.md`: how it works internally, with diagrams.

**Craft and structure are separate:**
- The **`engineering-documentation`** skill owns *how to write*: voice, Diátaxis page types (EDS-001…022), MDX components, accessibility, visuals, code examples, review and publish checklists. Locate it and read its `SKILL.md` before writing or editing any docs page, README, or ARCHITECTURE file.
- **Templates** own *structure*. Copy the template, fill it in, delete the guidance blocks, run its done-checklist.

| Artifact | Template |
| --- | --- |
| RFC (design proposal, architectural change) | `docs/RFC/TEMPLATE.md` |
| ADR (terse final decision record) | `docs/adr/TEMPLATE.md` |
| Review or audit report | `report/TEMPLATE.md` |
| Package `README.md` | `docs/templates/package-readme.template.md` (+ authoring guide) |
| Package `ARCHITECTURE.md` | `docs/templates/package-architecture.template.md` |

Templates index: `docs/templates/README.md`. For docs-site config, find the repo's current documentation instructions file. Do not assume a path.

**Rules**
- A doc that does not match its current template or standard is rewritten to comply. When you touch a package or feature with old-pattern docs, update them in the same change.
- Keep docs, examples, migration guides, and tests in sync with every behavior change.
- A finding that becomes a decision graduates to an RFC/ADR. Do not duplicate it across a report and an RFC/ADR.
- **Diagrams (EDS-012):** use the **`mermaid`** skill and pick the precise modern type: C4/architecture for topology, sequence for request lifecycle, state for lifecycles, ER for data, block/packet for structure. A generic flowchart where a truer type exists fails the quality gate. Read the skill's per-type reference first. `ARCHITECTURE.md` (GitHub) and the docs site (mermaid 11) get rich diagrams. Never add a diagram as decoration.

---

## 11. Specs, RFCs, and ADRs

NextRush uses **OpenSpec** (`openspec/`). Two layers with opposite lifecycles:

- **`openspec/specs/` is truth.** A small, stable set of capability specs (about 16), one folder per durable capability (`router`, `node-adapter`, …).
- **`openspec/changes/archive/` is history.** Disposable and gitignored. Git log is the real record. Durable decisions go to `docs/RFC/`.

**The one rule:** a change **edits an existing capability's requirements** (ADDED / MODIFIED / REMOVED). It does not create a new `specs/<capability>/` folder unless a genuinely new, durable capability is born, which is rare and must be justified.

- Name capabilities after durable things (`router`), never after changes (`*-fastpath`, `*-trim`, `*-cleanup`).
- Every capability spec has a real `## Purpose`, never a "TBD" stub.
- **RFC-gated:** new packages, new capabilities, and any public-API, routing, middleware, DI, adapter, or breaking change. Start from the RFC template. Record the durable decision as an ADR **before** archiving the change.
- **No dead-weight folders in the tree.** Do not keep `_archive/` or renamed-aside copies of old plans, docs, or code. They pollute `codebase-memory-mcp` indexes and mislead readers. Delete superseded work and recover it with `git log` or `git show <sha>:<path>`. The only exception is `openspec/changes/archive/`.

Full governance: `openspec/README.md`. Enforceable per-artifact rules: `openspec/config.yaml`. Read both before changing requirements.

---

## 12. Git

### Commit in logical groups

- Finish a **logical group of work**, verify it, then commit it. A group is one change a reviewer can understand alone: the code, its tests, and its docs, examples, and migration notes.
- **Separate commits** for: a refactor vs a behavior change, unrelated fixes, docs-only rewrites, dependency or lockfile changes, benchmark or audit artifacts.
- Do **not** commit after every small edit. Do **not** commit everything in one lump at the end. Do **not** mix unrelated work in one commit.
- Stage by explicit path or `git add -p`. Never use blind `git add -A` or `git add .`. Check `git status` and `git diff --staged` before each commit.
- Leave the user's unrelated changes unstaged and untouched.
- Build and relevant tests pass before committing. A commit must not break the build.
- Follow the style in `git log`. Short, specific subject. Add a body when the reason is not obvious.
- Do not commit during a read-only task (such as an audit), or when the user says not to.

### Needs explicit permission

Push, rebase, amend published commits, force-push, or any rewrite of shared history.

### Safe operations

- No destructive cleanup (`reset --hard`, `clean -fd`, mass delete, stash) to make the tree look clean. Never discard or overwrite user work without approval.
- Read scripts before running anything that installs packages, runs lifecycle hooks, deploys, deletes files, contacts external services, or may touch secrets.
- Avoid new dependencies unless they clearly improve the solution. Touch the lockfile only for a deliberate dependency change.

---

## 13. Skills and tools

Skills hold detailed procedures. This file holds stable constraints. Activate only the skills the task needs and read their `SKILL.md` first. Skill locations vary by agent and tool: discover them, never hardcode a vendor directory. If a skill is missing, say so and follow the repo's documented process.

| Need | Skill or tool |
| --- | --- |
| Writing or editing documentation | `engineering-documentation` |
| Deep systems reasoning and performance optimization | `systems-performance-engineering` |
| Diagrams | `mermaid` |
| Profiling, benchmarking, audits | `framework-audit-profiling`, `framework-profiling` |
| Code search and navigation | `codebase-memory-mcp` |
| Spec-driven changes | OpenSpec (`openspec/`) |
| Cross-runtime verification | `packages/adapters/conformance` |

Also look for package-specific development and release/testing skills when relevant.

How the agent should behave afterward
- Fixing a typo: no need to load the systems skill.
- Adding an ordinary feature: follow your existing architecture, code quality, and testing rules.
- Optimizing the router: load the systems skill, trace execution, form hypotheses, profile, and validate.
- Investigating request overhead: load the systems skill and framework-profiling.
- Conducting a complete architecture audit: load the systems skill when performance analysis is involved, plus framework-audit-profiling.

---

## 14. Decision filter

Before implementing a feature, ask:

1. Does it improve developer experience and reduce user work?
2. Can the framework automate it? Can the public API get smaller?
3. Does it add configuration that could be inferred?
4. Does it keep boundaries, dependency direction, and runtime independence?
5. Will a new user understand it without internal knowledge?
6. Is it documented and covered by automated tests, including conformance?
7. If it is about performance: is there profile evidence and a measured win (§6.3)?
8. Would we still choose this design, and could we still maintain it, in five years?

If any answer raises real doubt, redesign before implementing. Choose the smallest change that improves developer experience without weakening correctness, security, portability, or maintainability.

---

## 15. Completion report

At the end of a task, report briefly and in proportion to the task:

- What changed and why.
- Key files or areas touched.
- Verification commands run and their real results.
- Commits made, grouped by logical change, or why none were made.
- Known limitations, risks, and checks not run.
- Any decision that needs the maintainer's judgment.

Do not call work complete while required verification or documentation is outstanding. Name the gap.

---

NextRush succeeds when developers spend less time learning the framework and more time building their applications.
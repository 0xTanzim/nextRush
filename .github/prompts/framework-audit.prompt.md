---
description: "Unified framework audit — architecture, DX, security, performance, API stability, type ergonomics, and release-readiness enforcement for NextRush"
agent: software-engineer-nextrush
name: "NextRush Framework Audit"
argument-hint: "Optional: mode (release|refactor|dx|security), or specific module/package to audit"
model: Claude Opus 4.6 (copilot)
---

# NextRush Framework Audit

## Primary Directive

Audit **NextRush** as a **reusable backend framework** across two dimensions simultaneously:

1. **System-level integrity** — architecture, algorithms, performance, memory, concurrency, security, API stability, type safety, dependencies, error handling
2. **Developer experience** — installation, API ergonomics, pit-of-success design, type ergonomics, error messages, runtime compatibility, friction ranking

This is a **remediation task**, not a passive report. Detect issues. Fix issues. Re-score.

If any critical category fails its threshold, enter the remediation loop.

---

## Audit Mode

Select mode via `${input:mode}`. Default: `release`.

| Mode | Focus | Threshold Behavior |
|------|-------|-------------------|
| `release` | Strict thresholds, zero critical risks, full quality gate | All minimums enforced, no exceptions |
| `refactor` | Architecture integrity, regression prevention | Architecture and Stability categories weighted higher |
| `dx` | Ergonomics, API clarity, friction reduction | DX and Pit-of-Success categories weighted higher |
| `security` | Secure-by-default hardening, input validation | Security and Error Model categories weighted higher |

All modes execute all phases. Mode determines which failing categories trigger immediate blocking vs advisory findings.

---

## Scope

Target: `${workspaceFolder}`

Focus areas:

- Core architecture and module boundaries
- Public API surface and extension points
- Request/processing lifecycle pipeline
- Middleware, router, DI, plugin, and adapter layers
- Algorithmic complexity on hot paths
- Memory allocation and object lifetime
- Concurrency correctness
- Secure-by-default behavior
- Type system integrity
- Dependency surface
- Error propagation and observability
- Developer-facing ergonomics and friction
- Documentation accuracy

Public APIs must not break unless required for safety or correctness. If broken, document the migration path explicitly.

---

## Mandatory Scoring Model

Score each category from 0 to 10.

| Category | Minimum |
|---|---|
| Architecture Integrity | 8 |
| DX and Ergonomics | 8 |
| Pit-of-Success Design | 9 |
| Secure-by-Default | 9 |
| Algorithmic Efficiency | 8 |
| Performance | 8 |
| Memory Safety | 8 |
| Concurrency Safety | 8 |
| API Stability | 8 |
| Type Ergonomics | 8 |
| Dependency Hygiene | 7 |
| Error Model and Observability | 8 |
| Documentation Accuracy | 7 |

If any category scores below its minimum, the audit is **BLOCKED**. Enter the remediation loop. Maximum 3 remediation cycles per failing category.

---

## Phase 1 — System Mapping and Intent Validation

Map the complete system:

- Entry points and public exports
- Internal module graph and dependency flow
- Core pipeline: middleware chain, router, DI container, plugin system
- Adapter boundaries (Node, Bun, Deno, Edge)
- Error propagation flow
- Lifecycle hooks and extension points

Answer:

- What problem does NextRush solve?
- Who is the target developer (beginner backend, advanced architect, micro-framework user)?
- What complexity does NextRush hide? What does it expose?
- Where does friction still exist between hidden and exposed complexity?

Detect:

- Cyclic dependencies between packages
- Hidden global mutable state
- Cross-layer leakage (internal types, private APIs surfacing)
- God modules exceeding 500 LOC
- Side-effect-driven imports
- Runtime environment leakage into core
- Tight coupling between packages

Produce:

- Architecture summary
- Public API surface map
- Internal dependency graph (high-level)

---

## Phase 2 — DX and First Success Evaluation

Evaluate the path from install to running server:

- Number of steps, lines of code, files, and commands to Hello World
- Required configuration before first success
- Required manual wiring and boilerplate
- Required imports and concepts a user must understand
- Zero-config story: does it work without any configuration file?

Measure:

- Lines of code to Hello World (functional style)
- Lines of code to Hello World (class-based style)
- Required environment variables
- IntelliSense discoverability of public API

Detect:

- Abstraction overkill requiring reading internals to understand
- Repetitive wiring patterns
- Configuration verbosity beyond what the task requires
- Leaky internals in user-facing APIs
- Overloaded APIs with ambiguous behavior
- Naming that does not communicate intent

If first success exceeds minimal cognitive threshold, flag as HIGH FRICTION. If misuse is easy, flag as CRITICAL.

---

## Phase 3 — API Ergonomics and Friction Analysis

For every public API surface:

Evaluate:

- Parameters per function and required vs optional ratio
- Required explicit generics complexity
- Verbosity of route registration, middleware use, DI wiring, plugin registration
- Configuration object complexity (required keys, nesting depth)
- Naming clarity and consistency across packages
- Discoverability via IntelliSense and type hints

Detect:

- Overloaded function signatures with ambiguous behavior
- Required configuration objects that could have sensible defaults
- Repetitive patterns that should be abstracted
- User-facing complexity that leaks internal implementation details
- Abstractions that require reading source code to understand

For each pain point:

- Describe the friction
- Explain the cognitive cost
- Propose a simplified alternative
- Show the ideal minimal API shape

---

## Phase 4 — Pit-of-Success Enforcement

The framework must guide users toward correct, safe usage by default.

Verify:

- Secure defaults enabled without opt-in
- Body size limits enforced by default
- Request timeouts configured by default
- Errors masked in production mode (no stack traces, no internal paths)
- No unsafe mode enabled silently
- No optional step required for basic safety
- Safe configuration defaults for all adapters

If the framework is easy to misuse without explicit opt-in to unsafe behavior, flag as CRITICAL.

Pit-of-Success score must be 9 or above.

---

## Phase 5 — Algorithm and Hot Path Review

Audit all hot paths: routing lookup, middleware chaining, DI resolution, plugin resolution, request lifecycle, body parsing, context creation, response serialization.

Evaluate:

- Time complexity per operation
- Space complexity per operation
- Worst-case behavior under load
- Allocation frequency per request
- Deep cloning operations
- Linear scans in critical paths
- Nested loops in runtime pipeline
- Blocking synchronous operations
- Metadata recomputation per request

Flag and redesign:

- O(n^2) or worse in any runtime path
- Linear router matching without indexing
- Excessive serialization in loops
- Rebuilding metadata per request instead of caching
- Unbounded recursion or stack growth risk

If inefficient pattern found, refactor, re-evaluate complexity, and re-score.

---

## Phase 6 — Performance, Memory, and Concurrency

### Performance and Memory

Inspect:

- Object allocation frequency per request
- Buffer and stream handling correctness
- Backpressure handling in adapters
- EventEmitter usage and listener cleanup
- Closure capture leaks and accidental long-lived references
- Blocking filesystem or crypto calls
- Large synchronous loops
- Unbounded promise chains

### Concurrency

Inspect:

- Shared mutable state between requests
- Async race conditions in middleware chain
- Missing await on async operations
- Cancellation signal handling (AbortController)
- Burst behavior under concurrent load
- Graceful shutdown correctness

Classify each issue:

- SAFE
- PERFORMANCE RISK
- MEMORY RISK
- CONCURRENCY RISK
- CRITICAL

Zero CRITICAL issues allowed at completion.

---

## Phase 7 — Security Surface Hardening

The framework must be secure-by-default.

Audit inputs:

- Body size limits and content-type validation
- Header parsing strictness and injection prevention
- Route parameter type coercion safety
- Query string sanitization and prototype pollution prevention
- JSON depth limits
- Path traversal prevention
- DOS vectors (large payloads, slow reads, header floods)

Audit runtime:

- No `eval()`, `Function()`, or dynamic code execution
- No unsanitized template interpolation
- No `JSON.parse` without try/catch at boundaries
- Regex patterns validated for ReDoS
- No unsafe randomness for security-critical values
- No trust of user-provided object prototypes

Audit configuration:

- Default timeouts exist
- Error responses never leak stack traces, file paths, or package structure
- No insecure configuration defaults
- Explicit opt-in required for unsafe modes
- Dependency CVE scan clean

Security score must be 9 or above. If insecure-by-default, redesign defaults.

---

## Phase 8 — Public API and Version Evolution Safety

Analyze:

- All exported types, classes, and functions
- Extension points: middleware contracts, plugin interface, adapter interface
- Function overload ambiguity
- Hidden internal types leaking through public surface
- Breaking change risk on next minor/major version

Check:

- Can the API evolve without breaking existing consumers?
- Are extension points explicit and documented?
- Are defaults predictable and stable?
- Are generics understandable without reading source?
- Is the middleware/plugin contract stable across versions?

If evolution path is unclear or API boundary is fragile, flag as BLOCKED.

---

## Phase 9 — Type System Ergonomics

Evaluate:

- `any` usage in public and internal surface
- Unsafe type assertions (`as` casts)
- Required explicit generics that could be inferred
- Nested conditional types impacting IDE performance
- Public vs internal type separation
- Inferred types leaking internal structure
- Error type quality in TypeScript diagnostics

The framework must feel natural in the IDE:

- Minimize required generics
- No forced casting by users
- No leaked internal types in public API
- Public types must be explicit and documented
- Type inference must work without manual annotation in common cases

---

## Phase 10 — Dependency Hygiene

Audit:

- Unnecessary runtime dependencies
- Heavy transitive dependency trees
- Deprecated libraries
- Native module risk
- License conflicts
- Active security advisories

NextRush principle: zero external runtime dependencies except `reflect-metadata` for DI.

If unjustified dependencies exist, remove or vendor them. If a new dependency is unavoidable, document justification with size and security audit.

---

## Phase 11 — Error Model and Observability

Inspect:

- Typed error hierarchy (HttpError subclasses)
- Centralized error handling model
- Async error propagation correctness
- Promise rejection discipline
- No swallowed exceptions or silent catch blocks
- Stack trace control (debug vs production)
- Logging hooks and structured logging support
- Runtime error message clarity and helpfulness
- Configuration validation error quality
- Startup failure messages

Errors must be:

- Typed and predictable
- Traceable with clear stack traces in debug mode
- Masked in production mode
- Controllable via error middleware
- Human-readable with actionable suggestions where possible

---

## Phase 12 — Runtime and Bundler Compatibility

Verify:

- ESM and CJS dual export correctness
- Tree-shaking friendliness (no side-effect imports)
- Proper `exports` field in package.json for all packages
- Dynamic import safety
- Edge runtime compatibility (no Node-only APIs in core)
- Conditional exports for platform-specific adapters
- No environment assumptions leaking into core

Detect environment coupling that prevents portability.

---

## Phase 13 — Edge Case and Stress Scenarios

Test conceptually for each scenario:

- Large routing table (1000+ routes)
- Deep middleware stack (20+ layers)
- Malformed input payloads (invalid JSON, wrong content-type)
- Extremely large request bodies
- Concurrent request burst
- Plugin throwing synchronous and asynchronous errors
- Adapter failure mid-response
- Request timeout and cancellation
- Partial pipeline failure (middleware completes, handler fails)
- Graceful shutdown with in-flight requests
- Double response prevention (middleware sends response AND calls next)
- DI circular dependency at resolve time

For each:

- Describe the failure mode
- Describe the system impact
- Describe the current mitigation or lack thereof
- Propose mitigation if missing

---

## Phase 14 — Documentation Alignment

Verify:

- README reflects actual API (not aspirational or outdated)
- All public types are documented
- Secure defaults are documented explicitly
- Configuration options are documented with defaults and types
- Extension model (middleware, plugins, adapters) is documented
- Migration notes exist for breaking changes
- Versioning policy is stated
- Error model is documented with examples
- Examples in documentation actually compile and run

Outdated documentation is a defect. Treat it as a failing test.

---

## Phase 15 — Remediation Loop

When any category scores below its minimum:

1. Fix the highest severity issue first
2. Refactor root cause, not symptom
3. Avoid introducing breaking API changes unless required for safety
4. If breaking change is necessary, document the migration path
5. Re-score all affected categories after each fix
6. Repeat until thresholds met or 3 cycles reached

If after 3 cycles a threshold is still not met, declare an **architectural blocker** with:

- Root cause analysis
- Affected packages
- Proposed resolution path
- Estimated scope of change

---

## Quality Gate

Before the audit can complete, all of the following must be true:

- [ ] Build passes (`pnpm build`)
- [ ] Typecheck passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
- [ ] No CRITICAL risks remain
- [ ] All 13 categories meet their minimum thresholds
- [ ] Public API unchanged OR migration path documented
- [ ] No `any` in core runtime path
- [ ] Secure-by-default verified for all adapters
- [ ] No memory leak patterns detected
- [ ] No silent error swallowing

If not satisfied, re-enter remediation.

---

## DX Debt Ranking

After all phases complete, produce a ranked list:

### DX Blockers

Major friction preventing adoption. Must be resolved before release.

### High Friction

Reduces clarity or increases boilerplate significantly. Should be resolved.

### Medium Friction

Irritating but manageable. Plan for resolution.

### Low Friction

Minor improvements. Address opportunistically.

Each item must include:

- Problem description
- Why it matters for adoption
- Simplification direction
- Expected DX gain

Split into:

### Quick Wins

Low-risk changes that can ship immediately:

- Rename for clarity
- Better defaults
- Reduce required configuration
- Improve error messages
- Simplify API signatures
- Remove unnecessary boilerplate

### Deep Refactors

Architectural changes requiring migration planning:

- Remove abstraction layer
- Redesign middleware API
- Flatten configuration model
- Reduce generic complexity
- Unify adapter interfaces
- Restructure package boundaries

Estimate complexity and migration risk for each deep refactor.

---

## Required Output Structure

1. Executive Summary
2. Framework Intent Validation
3. System Architecture Map
4. DX Evaluation Summary
5. API Ergonomics Analysis
6. Pit-of-Success Verdict
7. Hot Path Complexity Review
8. Performance and Memory Findings
9. Concurrency Findings
10. Security Findings
11. API Stability Analysis
12. Type Ergonomics Analysis
13. Dependency Review
14. Error Model Analysis
15. Runtime Compatibility
16. Edge Case Risks
17. Documentation Alignment
18. Score Table (Before)
19. Fixes Applied
20. Score Table (After)
21. DX Debt Ranking
22. Quick Wins vs Deep Refactors
23. Release Readiness Verdict (Approved / Blocked / Conditional)

---

## Operational Rules

- Do not praise without evidence
- Do not soften weak areas
- Do not recommend speculative abstractions
- Do not recommend complexity increase for elegance
- Prefer reduction of user code over theoretical purity
- DX improvements must not reduce security
- Do not only report — fix
- Do not weaken type safety
- Do not increase dependency weight without justification
- Do not break public APIs silently
- Do not ignore performance hot paths
- Optimize for long-term maintainability
- If a fix introduces a breaking change, document the migration path before applying

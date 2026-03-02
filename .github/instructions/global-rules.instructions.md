---
description: 'Non-negotiable project rules, forbidden patterns, must-fix violations, security boundaries, and quality enforcement for all NextRush contributors and agents'
applyTo: '**'
---

# NextRush v3 Global Rules

Hard rules that apply everywhere — code, docs, tests, prompts, agents. No exceptions. No negotiation.

---

## 1. Package Hierarchy (Immutable)

```
types → errors → core → router → di → decorators → controllers → adapters → middleware
```

| Rule | Enforcement |
|------|-------------|
| Lower packages NEVER import from higher packages | Block the change |
| No circular dependencies between packages | Block the change |
| Cross-package imports use published interfaces only | No internal path imports |
| Type-only imports (`import type`) for package boundary types | Required |
| Every package has a clean barrel export (`index.ts`) | Required |

**On violation: Block the change. Fix the import. No exceptions.**

---

## 2. Forbidden Patterns (Auto-Block)

These patterns must NEVER appear in the codebase. Detection triggers immediate rejection.

| Pattern | Reason |
|---------|--------|
| `any` type usage | Use `unknown` at boundaries, proper types internally |
| `as any` type assertions | Breaks type safety guarantees |
| `eval()`, `Function()`, dynamic code execution | Code injection vector |
| `console.log` in production code | Use structured logging |
| Hardcoded secrets, API keys, or credentials | Security violation |
| `JSON.parse` without try/catch at system boundaries | Unhandled parse failure |
| Silent catch blocks (`catch {}` or `catch (e) {}`) | Error swallowing |
| Unsanitized template interpolation | Injection vector |
| Global mutable state | Non-deterministic behavior |
| Blocking synchronous I/O in async contexts | Performance killer |
| Prototype pollution vectors (`__proto__`, `constructor.prototype`) | Security violation |
| Unbounded loops or recursion without termination guarantee | DoS / hang risk |
| Side effects in module-level scope (except `reflect-metadata`) | Import order dependency |
| `require()` in ESM modules | Module system violation |
| Runtime-specific APIs in core packages (`process`, `Deno`, `Bun`) | Platform coupling |

---

## 3. Must-Fix Violations (Auto-Remediate)

If detected, fix immediately before any other work proceeds.

- Memory leak patterns (event listeners without cleanup, unbounded caches, timers without clear)
- Missing input validation at system boundaries
- Response sent without explicit status code
- Middleware that neither calls `next()` nor sends a response
- Unhandled promise rejections in async chains
- Missing error propagation in async middleware
- Exposed internal stack traces in error responses
- Missing `Content-Type` headers in responses
- Regex patterns vulnerable to ReDoS
- N+1 query patterns

---

## 4. Security Boundaries (Non-Negotiable)

| Boundary | Requirement |
|----------|-------------|
| Error responses | NEVER leak internal paths, stack traces, or package structure in production |
| Request body parsing | Enforces size limits |
| Route parameters | Validated for type and format |
| Header handling | No header injection vectors |
| CORS | Never defaults to wildcard in production |
| Rate limiting | Available and documented for all public endpoints |
| Middleware ordering | Authentication runs before business logic |
| Code generation | No `eval()`, `Function()`, or dynamic code generation |
| Dependencies | Audited for known CVEs before adoption |
| IP trust | No trust of `req.ip` without explicit proxy configuration |

---

## 5. Performance Constraints

### Targets

| Metric | Target |
|--------|--------|
| Hello World RPS | 35,000+ |
| Core size | <3,000 LOC |
| Cold start | <30ms |
| Memory footprint | <200KB |
| Package max LOC | Per package limits in `v3-architecture.instructions.md` |

### Rules

- No unnecessary allocations in hot paths (middleware chain, router lookup)
- No closures in tight loops
- Prefer static dispatch over dynamic where possible
- No blocking I/O in core or middleware packages
- No deep cloning in request lifecycle
- No `JSON.stringify`/`JSON.parse` round-trips for internal data transfer

---

## 6. Zero Dependency Rule

- No external runtime dependencies except `reflect-metadata` (required for DI)
- Dev dependencies are acceptable (testing, building, linting)
- If an external dep seems necessary, document justification with size/security audit
- Prefer vendoring small utilities (<50 lines) over adding npm packages

---

## 7. API Contract Rules

- Public API changes require documentation update in the same commit
- Breaking changes require a migration guide
- Deprecated APIs include `@deprecated` JSDoc with the alternative specified
- No implicit behavior changes — all changes explicitly documented
- Exported types must be complete and documented
- No internal types leaked through public API surface

---

## 8. Test Requirements

| Requirement | Threshold |
|-------------|-----------|
| Line coverage per package | 90%+ (enforced in CI) |
| Bug fix | Includes regression test |
| New public API | Includes usage tests |
| Edge cases from architecture docs | Corresponding tests required |

- No test that depends on external services without mocking
- Tests must be deterministic — no timing-dependent assertions
- No test-only code paths in production source

---

## 9. Documentation Rules

- Every public API has a corresponding documentation entry
- Code examples in docs must be copy-paste runnable
- Documentation must match current implementation (code wins over outdated docs)
- No marketing language in technical docs
- No undocumented default behavior

---

## 10. What Must Always Be Done

- TypeScript strict mode — zero errors
- ESLint clean — zero warnings in CI
- All exports through barrel files (`index.ts`)
- Proper error hierarchy usage (`HttpError` subclasses)
- Middleware follows Koa-style async pattern
- Plugin implements the `Plugin` interface
- Adapter isolates platform-specific code
- Context API used for request/response (never raw `req`/`res`)

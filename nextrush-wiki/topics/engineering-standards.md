---
title: Engineering Standards & Global Rules
type: topic
created: 2026-07-10
sources: []
tags: [standards, rules, security, forbidden-patterns]
---
# Engineering Standards & Global Rules

Source: `.kiro/steering/global-rules.instructions.md`, `.kiro/steering/typescript.instructions.md`, and global `~/.kiro/steering/engineering-standards.md` / `code-structure.md`.

## Package Hierarchy Rule
`types → errors → core → router → di → decorators → controllers → adapters → middleware`. Lower packages NEVER import from higher. No circular deps. Cross-package imports via published interfaces only (no internal path imports). `import type` required at package boundaries. Every package has a clean barrel `index.ts`. **Violation → block the change, fix the import, no exceptions.**

## Forbidden Patterns (auto-block)
`any` type, `as any`, `eval()`/`Function()`, `console.log` in production, hardcoded secrets, unguarded `JSON.parse`, silent catch blocks, unsanitized template interpolation, global mutable state, blocking sync I/O in async contexts, prototype pollution vectors, unbounded loops/recursion, module-level side effects (except `reflect-metadata`), `require()` in ESM, runtime-specific APIs (`process`, `Deno`, `Bun`) in core packages.

## Zero Dependency Rule
No external runtime deps in core/router/errors/types/adapters/middleware. Approved exceptions: `reflect-metadata` (DI metadata), `tsyringe` (`@nextrush/di` only), `@clack/prompts` (`create-nextrush` scaffolder only). Vendor small utilities (<50 lines) instead of adding npm packages where practical.

## TypeScript Standards
- Target ES2022, pure ES modules only, strict mode + `noUncheckedIndexedAccess` + `noUnusedLocals/Parameters` + `verbatimModuleSyntax`.
- Zero `any` policy — use `unknown` at boundaries.
- Naming: PascalCase types/classes, camelCase vars/functions, kebab-case filenames, no `I` prefix on interfaces.
- `index.ts` = public exports only, never implementation.
- No relative imports across package boundaries.

## Security Boundaries
Error responses never leak stack traces/paths in production. Body parsing enforces size limits. Route params validated for type/format. No header injection vectors. CORS never wildcards in production. Rate limiting documented for public endpoints. Auth middleware runs before business logic. No dynamic code generation. Dependencies audited for CVEs.

## Test Requirements
90%+ line coverage per package (CI-enforced). Bug fixes require regression tests. New public APIs require usage tests. No flaky/order-dependent tests.

## Related
- [[topics/tdd-workflow]] — the process discipline underneath these standards.
- [[topics/architecture]] — the hierarchy these rules protect.

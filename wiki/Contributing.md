# Contributing

Thank you for contributing to NextRush! This guide covers everything you need to get started.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 22.0.0 |
| pnpm | latest |
| Git | any recent version |

---

## Development Setup

```bash
# Clone the repository
git clone https://github.com/0xTanzim/nextrush.git
cd nextrush

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test
```

---

## Development Commands

```bash
pnpm install                              # Install all dependencies
pnpm build                                # Build all packages
pnpm test                                 # Run all tests
pnpm typecheck                            # Type check all packages
pnpm lint                                 # Lint all packages
pnpm clean                                # Clean build artifacts

# Scoped commands (single package)
pnpm --filter @nextrush/core build
pnpm --filter @nextrush/core test
pnpm --filter @nextrush/core test -- --coverage
pnpm --filter @nextrush/router typecheck
```

---

## Project Structure

```
nextrush/
├── packages/
│   ├── types/           # @nextrush/types — shared types (no deps)
│   ├── errors/          # @nextrush/errors — HTTP errors
│   ├── core/            # @nextrush/core — Application, middleware
│   ├── router/          # @nextrush/router — Radix-tree routing
│   ├── di/              # @nextrush/di — Dependency injection
│   ├── decorators/      # @nextrush/decorators — Controller decorators
│   ├── runtime/         # @nextrush/runtime — Runtime detection
│   ├── nextrush/        # nextrush — Meta package
│   ├── adapters/        # Platform adapters
│   ├── middleware/       # Middleware packages
│   └── plugins/         # Plugin packages
├── apps/
│   ├── docs/            # Documentation site
│   ├── benchmark/       # Benchmark suite
│   └── playground/      # Testing playground
└── draft/               # Architecture docs & RFCs
```

---

## Package Hierarchy Rule

Lower packages **never** import from higher packages. No circular dependencies.

```
types → errors → core → router → di → decorators → controllers → adapters → middleware
```

Use `import type` for all cross-package type-only imports.

---

## Coding Standards

### TypeScript

- **Strict mode** — zero `any` usage; use `unknown` at system boundaries
- **ES2022** target with `NodeNext` module resolution
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- Generic types over type assertions
- No `as any`, no `@ts-ignore` without a documented reason

### Naming Conventions

| Scope | Convention |
|---|---|
| Variables and functions | `camelCase` |
| Types, interfaces, classes | `PascalCase` |
| Constants | `SCREAMING_SNAKE_CASE` |
| File names | `kebab-case.ts` |
| Test files | `kebab-case.test.ts` |

### Code Organization

- Each package exports through a single `src/index.ts` barrel file
- Implementation files live in `src/`
- Tests live in `src/__tests__/`
- No side effects at module scope (except `reflect-metadata` import in DI code)
- No runtime-specific APIs (`process`, `Deno`, `Bun`) in core packages

### Zero Dependencies Rule

No external runtime dependencies in core, router, errors, types, adapters, or middleware packages.
Approved exceptions:
- `reflect-metadata` — required for DI decorators
- `tsyringe` — DI container (`@nextrush/di` only)
- `@clack/prompts` — CLI scaffolder only

---

## Testing

- **Framework**: Vitest
- **Coverage target**: 90%+ per package (enforced in CI)
- Test files: `src/__tests__/*.test.ts` (co-located with source)

### Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('feature name', () => {
  it('should do expected thing', () => {
    // arrange
    // act
    // assert
  });

  it('should handle edge case', () => {
    // ...
  });
});
```

### Running Tests

```bash
# All packages
pnpm test

# Single package
pnpm --filter @nextrush/core test

# With coverage
pnpm --filter @nextrush/core test -- --coverage

# Watch mode
pnpm --filter @nextrush/core test -- --watch
```

### Test Requirements

- Every bug fix must include a regression test
- Every new public API must have usage tests
- Edge cases documented in architecture docs need corresponding tests
- No tests that depend on external services (mock them)
- Tests must be deterministic — no timing-dependent assertions

---

## Making Changes

1. **Fork** the repository on GitHub
2. **Create a branch**: `git checkout -b feat/my-feature`
3. **Make changes** following the coding standards
4. **Add tests** for new functionality
5. **Run quality gates**:
   ```bash
   pnpm build && pnpm typecheck && pnpm lint && pnpm test
   ```
6. **Commit** with a descriptive message (see Commit Messages below)
7. **Open a Pull Request** against `main`

---

## Commit Messages

Format: `type(scope): description`

```
feat(core): add plugin lifecycle hooks
fix(helmet): correct CSP directive merging
test(csrf): add double-submit cookie edge cases
docs(router): update API reference
perf(router): add O(1) static route fast path
refactor(di): simplify circular dependency detection
chore(deps): update tsyringe to 4.9
```

**Types**: `feat`, `fix`, `test`, `docs`, `refactor`, `perf`, `chore`

**Scopes**: package name (e.g. `core`, `router`, `helmet`, `di`)

---

## Package Size Limits

| Package | Max LOC |
|---|---|
| `@nextrush/types` | 500 |
| `@nextrush/errors` | 600 |
| `@nextrush/core` | 1,500 |
| `@nextrush/router` | 1,000 |
| `@nextrush/di` | 400 |
| `@nextrush/decorators` | 800 |
| `@nextrush/controllers` | 800 |
| `@nextrush/adapter-*` | 500 |
| `@nextrush/middleware/*` | 300 |
| `@nextrush/plugin/*` | 600 |

---

## Documentation

- Every new public API must have a documentation entry
- Code examples in docs must be copy-paste runnable
- Keep documentation in sync with implementation (code wins over outdated docs)
- No marketing language in technical docs

---

## Reporting Issues

- Use [GitHub Issues](https://github.com/0xTanzim/nextrush/issues)
- Include a minimal reproduction case
- Specify: Node.js version, runtime (Node / Bun / Deno), OS

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](https://github.com/0xTanzim/nextRush/blob/main/LICENSE).

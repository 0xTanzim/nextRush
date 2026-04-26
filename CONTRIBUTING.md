# Contributing to NextRush

Thank you for your interest in contributing to NextRush! This guide covers the essentials you need to get started.

## Prerequisites

- **Node.js** ≥ 22.0.0
- **pnpm** (latest)
- **Git**

## Quick Start

```bash
# Clone the repository
git clone https://github.com/0xTanzim/nextrush.git
cd nextrush

# Install dependencies (no automatic full build — run build when you need compiled packages)
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test
```

## Monorepo Structure

NextRush is organized as a modular monorepo using Turborepo and pnpm workspaces:

```
packages/
├── types/           # Shared TypeScript types
├── errors/          # HTTP error classes
├── core/            # Application, middleware composition
├── router/          # Radix tree routing
├── di/              # Dependency injection
├── decorators/      # Controller/route decorators
├── runtime/         # Runtime detection
├── nextrush/        # Meta package (re-exports)
├── adapters/        # Node, Bun, Deno, Edge
├── middleware/       # cors, helmet, csrf, body-parser, etc.
└── plugins/         # controllers, events, logger, etc.
```

## Development Commands

```bash
pnpm install                           # Install dependencies
pnpm build                             # Build all packages
pnpm test                              # Run all tests
pnpm typecheck                         # Type check all packages
pnpm lint                              # Lint all packages
pnpm clean                             # Clean build artifacts
pnpm --filter @nextrush/<pkg> test     # Test a specific package
pnpm --filter @nextrush/<pkg> build    # Build a specific package
```

## Package Hierarchy

Lower packages **never** import from higher packages. No circular dependencies.

```
types → errors → core → router → di → decorators → controllers → adapters → middleware
```

## Coding Standards

### TypeScript

- **Strict mode** — zero `any` usage
- **ES2022** target
- `verbatimModuleSyntax` enabled — use `import type` for type-only imports
- Generic types over type assertions
- `unknown` over `any` at system boundaries

### Style

- Function and variable names: `camelCase`
- Types, interfaces, classes: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- File names: `kebab-case.ts`
- Barrel exports via `index.ts`

### Zero Dependencies

No external runtime dependencies (except `reflect-metadata` for DI). If you need utility functionality, implement it internally.

## Testing

- **Framework**: Vitest
- **Coverage target**: 90%+ per package
- Test files are co-located with source: `src/__tests__/*.test.ts`
- Test both happy paths and edge cases
- Include error scenarios

```bash
# Run tests for a specific package
pnpm --filter @nextrush/core test

# Run tests with coverage
pnpm --filter @nextrush/core test -- --coverage
```

## Making Changes

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feat/my-feature`
3. **Make your changes** following the coding standards above
4. **Add tests** for new functionality
5. **Run quality gates**:
   ```bash
   pnpm build && pnpm typecheck && pnpm test
   ```
6. **Commit** with a descriptive message
7. **Open a Pull Request** against `main`

## Commit Messages

Use clear, descriptive commit messages:

```
feat(core): add plugin lifecycle hooks
fix(helmet): correct CSP directive merging
test(csrf): add double-submit cookie edge cases
docs(router): update API reference
```

Format: `type(scope): description`

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `perf`, `chore`

## Package Size Limits

Each package has a maximum LOC target. Check the [copilot instructions](.github/copilot-instructions.md) for limits.

## Reporting Issues

- Use [GitHub Issues](https://github.com/0xTanzim/nextrush/issues)
- Include a minimal reproduction
- Specify your Node.js version and runtime (Node, Bun, Deno)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

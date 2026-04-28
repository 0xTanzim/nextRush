# Contributing

How to build the repo locally, keep packages layered correctly, and ship changes that pass CI.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 22 |
| pnpm | current |
| Git | recent |

---

## Clone and bootstrap

```bash
git clone https://github.com/0xTanzim/nextRush.git
cd nextRush
pnpm install
pnpm build
pnpm test
```

---

## Everyday commands

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm clean

pnpm --filter @nextrush/core build
pnpm --filter @nextrush/core test
pnpm --filter @nextrush/core test -- --coverage
```

---

## Layout

```
nextRush/
├── packages/     types, errors, core, router, di, decorators, adapters, middleware, plugins, …
├── apps/docs     documentation site
├── apps/benchmark
└── apps/playground
```

---

## Layering rule

```
types → errors → core → router → di → decorators → controllers
```

Nothing below may import from anything above. No cycles. Cross-package boundaries use `import type` when only types cross.

---

## Code expectations

- TypeScript strict; no `any`.
- Barrel exports (`src/index.ts`) per package.
- Tests under `src/__tests__/` with Vitest; coverage targets apply in CI.
- No runtime deps in foundation packages except approved exceptions (`reflect-metadata`, `tsyringe` in `@nextrush/di`, `@clack/prompts` in `create-nextrush`).
- No platform globals (`process`, `Deno`, `Bun`) inside `@nextrush/core`.

Naming: `camelCase` functions/vars, `PascalCase` types/classes, `kebab-case.ts` files.

---

## Tests

```bash
pnpm test
pnpm --filter @nextrush/core test -- --watch
```

Bug fixes include regression coverage; new public APIs get usage tests.

---

## Pull request flow

1. Fork and branch (`feat/…`, `fix/…`).
2. Implement with tests.
3. Run `pnpm build && pnpm typecheck && pnpm lint && pnpm test`.
4. Open a PR toward `main`.

---

## Commit messages

```
type(scope): description
```

Examples: `feat(core): …`, `fix(router): …`, `docs(errors): …`

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `perf`, `chore`.

---

## Package size budgets

See [Architecture](Architecture) for LOC targets per package.

---

## Documentation

Public API changes ship with docs updates (wiki + `apps/docs` as appropriate). Examples must compile against current exports.

---

## Issues

Report bugs with reproduction steps, Node version, and runtime (Node / Bun / Deno): [Issues](https://github.com/0xTanzim/nextRush/issues).

---

## License

Contributions fall under the [MIT License](https://github.com/0xTanzim/nextRush/blob/main/LICENSE).

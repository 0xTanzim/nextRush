# Scaffolding & Dev CLI

## create-nextrush

```bash
pnpm create nextrush my-api
npx create-nextrush@latest my-api
pnpm dlx create-nextrush@latest my-api

# Non-interactive
pnpm create nextrush my-api --yes --no-git --no-install
```

Interactive choices typically include:

- Style: **functional** | **class-based** | **full**
- Runtime target: **node** | **bun** | **deno**
- Middleware preset
- Package manager

Class/full templates add `nextrush/class` (and DI stack) automatically.

## @nextrush/dev CLI

```bash
pnpm add -D @nextrush/dev

nextrush dev              # development server (multi-runtime aware)
nextrush build            # production build
nextrush generate controller user
nextrush g c user         # aliases
nextrush g s user-profile # service
nextrush g mw logger      # middleware (functional)
nextrush g guard auth
nextrush g r products     # functional route module
nextrush generate adapter # scaffold a custom runtime adapter
nextrush codemod          # automated migrations
```

| Generator | Alias | Output |
|-----------|-------|--------|
| controller | c | `src/controllers/<name>.controller.ts` |
| service | s | `src/services/<name>.service.ts` |
| middleware | mw | `src/middleware/<name>.ts` |
| guard | g | `src/guards/<name>.guard.ts` |
| route | r | `src/routes/<name>.ts` |

## package.json scripts (typical scaffold)

```json
{
  "scripts": {
    "dev": "nextrush dev",
    "build": "nextrush build",
    "start": "node dist/index.js"
  }
}
```

## Why not tsup alone?

Class-based apps need decorator metadata emit. `@nextrush/dev` handles multi-runtime builds and metadata correctly. See package ARCHITECTURE for details.

## Programmatic

```typescript
import { generate, dev, build } from '@nextrush/dev';
await generate('controller', 'user', process.cwd());
```

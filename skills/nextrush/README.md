# NextRush Copilot Skill

AI coding skill for the [NextRush](https://github.com/0xTanzim/nextrush) framework — a minimal, modular, high-performance Node.js/Bun/Deno framework with zero runtime dependencies.

## What This Skill Does

Teaches AI assistants (GitHub Copilot, Claude, etc.) to write correct NextRush code by providing:

- **Import architecture** — dual entry points: `nextrush` (functional) and `nextrush/class` (decorators + DI)
- **Complete API reference** — Context, Router, Application, Middleware, Error handling
- **28 package catalog** — core, router, errors, 10 middleware, 4 adapters, 6 plugins, DI, decorators
- **Code patterns** — functional routes, decorator controllers, guards, param injection, middleware composition
- **Troubleshooting** — common mistakes, import errors, tsconfig requirements

## Install

```bash
# GitHub Copilot (VS Code)
npx skills add https://github.com/0xTanzim/nextrush --skill nextrush

# Or copy the skill folder into your project
cp -r skills/nextrush /path/to/your/project/skills/
```

## Skill Structure

```
nextrush/
├── SKILL.md                              # Main skill (loaded into AI context)
├── LICENSE.txt                           # MIT license
├── README.md                             # This file
└── references/                           # Deep-dive docs (loaded on demand)
    ├── controllers.md                    # Decorator-based controllers & guards
    ├── dependency-injection.md           # DI container, services, scopes
    ├── error-handling.md                 # 40+ error classes, factory functions
    ├── middleware.md                     # 10 built-in middleware packages
    ├── routing.md                        # Router API, params, composition
    └── ecosystem.md                      # Plugins, adapters, dev tools
```

## What It Covers

| Area                    | Coverage                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| Functional routing      | `createApp`, `createRouter`, `listen`, route params, wildcards                                  |
| Class-based controllers | `@Controller`, `@Get/@Post/...`, `@Body/@Param/@Query`                                          |
| Dependency injection    | `@Service`, `@Repository`, `@Config`, `container`, scopes                                       |
| Guards                  | `@UseGuard`, `GuardFn`, `CanActivate`, class + method level                                     |
| Error handling          | `HttpError` hierarchy, `errorHandler()`, `ctx.throw()`, `ctx.assert()`                          |
| Middleware              | body-parser, cors, helmet, rate-limit, compression, cookies, csrf, multipart, request-id, timer |
| Adapters                | Node.js, Bun, Deno, Edge (Cloudflare/Vercel/Netlify)                                            |
| Plugins                 | controllers, events, logger, static, template, websocket                                        |
| Dev tools               | CLI (`nextrush dev/build/generate`), `create-nextrush` scaffolder                               |

## Framework Requirements

- Node.js >= 22.0.0
- TypeScript 5.x (strict mode)
- For class-based: `experimentalDecorators` + `emitDecoratorMetadata` in tsconfig

## Example Prompts

After installing this skill, try:

- _"Create a REST API for users with CRUD operations using NextRush"_
- _"Add JWT authentication guard to my NextRush controller"_
- _"Set up cors, helmet, and rate-limit middleware for my nextrush app"_
- _"Help me scaffold a new nextrush project with create-nextrush"_
- _"Convert my Express router to NextRush functional routes"_

## License

MIT — see [LICENSE.txt](LICENSE.txt)

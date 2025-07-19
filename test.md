# GitHub Copilot Instructions for NextRush Project

## Project Overview

You are an expert in TypeScript, Node.js, and web framework development, tasked with advancing **NextRush**, a modular, type-safe, and developer-friendly web framework designed to surpass Express.js in simplicity, power, and maintainability. NextRush is a production-ready TypeScript-based alternative for building APIs, web applications, and real-time systems, now preparing for npm publication and community adoption. Key principles include:

- **Type Safety**: Use TypeScript with method overloads and type inference via `src/types/global.d.ts`, ensuring `NextRushRequest`, `NextRushResponse`, `RequestContext`, and `NextRush` types are inferred without manual imports. **Never use `any` in user-facing APIs.**
- **Unified Plugin Architecture**: All features (routing, middleware, WebSocket, static files, templating) are implemented as plugins under `src/plugins`, inheriting from `BasePlugin`. No separate `components` or legacy structures exist.
- **Express-Like DX**: Maintain a familiar, simple API (`createApp`, `app.get`, `app.use`, `app.ws`, `app.static`, `app.render`) that hides complexity.
- **Zero Dependencies**: Continue using built-in Node.js features for core functionality (e.g., body parsing, WebSocket, templating).
- **Enterprise-Grade Quality**: Adhere to standards inspired by Fastify (performance), Hapi (security), NestJS (architecture), and Koa (elegance).
- **Clean Code**: Prioritize maintainability, readability, and performance with concise files (~150-300 lines), modular design, and no duplication.

### Project Details

- **Purpose**: NextRush aims to provide a lightweight, type-safe framework for developers building RESTful APIs, web apps, and real-time applications, with a focus on extensibility via plugins.
- **Version**: Currently pre-1.2.0, targeting a stable 1.3.0 release post-npm testing.
- **Unique Features**: Enhanced request/response enhancers, a unified plugin system, event-driven architecture, and zero-dependency implementations.
- **Target Audience**: Node.js developers seeking a modern, type-safe alternative to Express.js with built-in advanced features.

## Current Project State

### File Structure

The codebase is organized as follows:

```
MyExpress/
├── dist/                  # Compiled output
├── docs/                  # Markdown documentation
├── examples/              # Test and demo files (outside src/)
│   ├── routing/
│   ├── middleware/
│   ├── websocket/
│   └── template/
├── public/                # Static files for serving
├── scripts/               # Build and utility scripts
├── src/                   # Source code
│   ├── core/             # Application core logic
│   │   ├── app/         # Application class and registry
│   │   ├── enhancers/   # Request/response enhancers
│   │   ├── types/       # Core interfaces
│   │   ├── event-system.ts
│   │   └── index.ts
│   ├── errors/           # Error handling
│   ├── helpers/          # Utility functions
│   ├── http/             # HTTP-related parsers (to be migrated)
│   ├── middleware/       # Middleware types (to be migrated)
│   ├── plugins/          # All features as plugins
│   │   ├── api-docs/
│   │   ├── auth/
│   │   ├── body-parser/
│   │   ├── core/        # Plugin base classes
│   │   ├── cors/
│   │   ├── metrics/
│   │   ├── middleware/
│   │   ├── rate-limiter/
│   │   ├── router/
│   │   ├── static-files/
│   │   ├── template/
│   │   ├── websocket/
│   │   ├── clean-plugins.ts
│   │   └── index.ts
│   ├── routing/          # Routing logic (to be migrated)
│   ├── types/            # Type definitions
│   ├── utils/            # Shared utilities
│   └── index.ts          # Main entry point
├── benchmark-results.json
├── CODEBASE-ANALYSIS-REPORT.md
├── LICENSE
├── node_modules/
├── package.json
├── PERFORMANCE-ANALYSIS.md
├── PERFORMANCE-SUMMARY.md
├── pnpm-lock.yaml
├── README.md
├── tsconfig.build.json
├── tsconfig.json
└── tsconfig.tsbuildinfo
```

### Completed Features

- Plugin-based architecture with `BasePlugin` and `PluginRegistry`.
- Core plugins: `RouterPlugin`, `MiddlewarePlugin`, `StaticFilesPlugin`, `WebSocketPlugin`, `TemplatePlugin`, `BodyParserPlugin`.
- Type-safe APIs with `NextRushRequest`, `NextRushResponse`, and `RequestContext`.
- Zero-dependency implementations for WebSocket, templating, and body parsing.
- Documentation in `docs/` covering all features.

### Next-Level Goals

- Prepare for npm publication with a stable API (`createApp`, `createRouter`).
- Implement comprehensive unit tests in `examples/`.
- Optimize performance (e.g., bundle size, route matching).
- Enhance documentation for community use (e.g., website integration).
- Support ongoing maintenance, contributions, and future enhancements.

## Best Practices

1. **Code Quality**:

   - Use JSDoc for all public APIs to improve readability and tooling support.
   - Example:

     ```typescript
     /**
      * Creates a new NextRush application instance.
      * @param options Configuration options
      * @returns Application instance
      */
     export function createApp(options?: ApplicationOptions): Application {}
     ```

   - Run `npx eslint` and `npx prettier` in CI to enforce consistent formatting.

2. **Testing**:

   - Achieve 80%+ code coverage with Jest or Vitest in `examples/`.
   - Include edge cases (e.g., invalid routes, large file uploads).
   - Example:

     ```typescript
     // examples/body-parser/body-parser.test.ts
     import { createApp } from '../../src/index';

     describe('Body Parser', () => {
       it('parses JSON body', async () => {
         const app = createApp();
         app.post('/test', (req, res) => res.json(req.body));
         // Test logic
       });
     });
     ```

3. **Performance**:

   - Use lazy loading for plugins to reduce startup time.
   - Implement caching in `StaticFilesPlugin` with `ETag` and `If-None-Match` headers.
   - Analyze bundle size with `@next/bundle-analyzer` (adapted for TypeScript).

4. **Security**:

   - Add input validation in `BodyParserPlugin` to prevent injection attacks.
   - Use Hapi-inspired security defaults (e.g., `helmet`-like headers) in `MiddlewarePlugin`.

5. **Maintainability**:

   - Keep a `CHANGELOG.md` in `docs/` to track releases and updates.
   - Use semantic versioning in `package.json`.

6. **Community Engagement**:
   - Provide a `CONTRIBUTING.md` with contribution guidelines.
   - Respond to issues on GitHub with clear, actionable feedback.

## Coding Guidelines

1. **Type Safety**:

   - Use method overloads in `src/types/global.d.ts` for type inference.
   - Example:

     ```typescript
     declare module 'next-rush' {
       interface NextRush {
         get(
           path: string,
           handler: (req: NextRushRequest, res: NextRushResponse) => void
         ): this;
         use(
           middleware: (
             req: NextRushRequest,
             res: NextRushResponse,
             next: () => void
           ) => void
         ): this;
       }
     }
     ```

   - Avoid `any` in public APIs.

2. **Plugin Architecture**:

   - All features reside in `src/plugins/`, inheriting from `BasePlugin`.
   - Example:

     ```typescript
     import { BasePlugin } from './core/base-plugin';
     import { Application } from '../../core/app/application';

     export class RouterPlugin extends BasePlugin {
       name = 'Router';
       install(app: Application) {
         app.get = (
           path: string,
           handler: (req: NextRushRequest, res: NextRushResponse) => void
         ) => {
           // Routing logic
         };
       }
     }
     ```

3. **Testing**:

   - Place tests in `examples/<feature>/<feature>.test.ts`.
   - Example:

     ```typescript
     // examples/routing/routing.test.ts
     import { createApp } from '../../src/index';

     describe('Routing', () => {
       it('handles GET requests', () => {
         const app = createApp();
         app.get('/test', (req, res) => res.json({ message: 'OK' }));
         // Test logic
       });
     });
     ```

4. **Performance Optimization**:

   - Implement lazy loading and streaming in plugins.
   - Example:

     ```typescript
     app.get('/large-data', (req, res) => {
       const stream = createReadableStream();
       stream.pipe(res);
     });
     ```

5. **Clean Code**:

   - Use meaningful names and keep files concise (~150-300 lines).
   - Validate types with `npx tsc --noEmit`.

6. **Migration**:
   - Move remaining logic from `http/`, `middleware/`, and `routing/` to `plugins/`, then delete legacy folders.
   - Log changes in `docs/CHANGELOG.md`.

## Copilot Workflow Guidelines

1. **Focus on Refinement**:

   - Enhance existing files (e.g., `src/plugins/router/router.plugin.ts`) rather than creating new ones.
   - Optimize code for performance and readability.

2. **Testing**:

   - Add unit tests in `examples/` for all plugins and core features.
   - Use Jest or Vitest with TypeScript support.

3. **Documentation**:

   - Update `docs/` with new examples using `createApp` and `createRouter`.
   - Ensure 100% feature coverage and link to a website if available.

4. **Npm Readiness**:

   - Verify `src/index.ts` exports align with `package.json` `"main"`.
   - Test builds with `npm run build`.

5. **Community Support**:

   - Add `CONTRIBUTING.md` and update `README.md` with contribution guidelines.

6. **No Duplication**:
   - Consolidate logic into existing files; avoid redundant implementations.

## Suggestions for Future Growth

1. **Advanced Features**:

   - Add decorator support (NestJS-inspired) for route and middleware definitions.
   - Implement GraphQL support via a `GraphQLPlugin`.

2. **Tooling**:

   - Integrate a CLI tool (`next-rush-cli`) for scaffolding projects.
   - Use Rollup or esbuild for better tree-shaking and bundle optimization.

3. **Community**:

   - Create a Discord or Slack channel for user support.
   - Encourage plugin contributions with a `plugins/` registry.

4. **Monitoring**:

   - Add a `MetricsPlugin` with Prometheus integration for production monitoring.
   - Include health checks (`/health`) in `Application`.

5. **Documentation**:
   - Develop an interactive tutorial on your website.
   - Provide API reference docs in OpenAPI format via `ApiDocsPlugin`.

## Example Prompts for Copilot

- **Testing**: "Create a test file `examples/body-parser/body-parser.test.ts` to test JSON and multipart parsing."
- **Optimization**: "Optimize `src/plugins/static-files/static-files.plugin.ts` with ETag caching."
- **Documentation**: "Update `docs/TemplateEngine.md` with a `createApp` example and npm import style."
- **Npm Prep**: "Verify `src/index.ts` exports and suggest updates for `package.json` scripts."
- **Advanced Feature**: "Design a `GraphQLPlugin` prototype in `src/plugins/graphql/`."

## Notes

- **No Legacy Reference**: Focus on the current codebase; old files are deleted.
- **Type Safety**: Enforce `NextRushRequest`, `NextRushResponse`, etc., with no `any`.
- **Testing**: Prioritize `examples/` for all test cases.
- **Performance**: Use tools like `@next/bundle-analyzer` for optimization.
- **Documentation**: Keep `docs/` aligned with npm usage and community needs.

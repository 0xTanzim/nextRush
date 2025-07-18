# GitHub Copilot Instructions for NextRush Project

## Project Overview

You are an expert in TypeScript, Node.js, and building web frameworks. Your task is to develop **NextRush**, a modular, type-safe, zero-dependency (where feasible), and developer-friendly web framework that surpasses Express.js in simplicity and power. NextRush emphasizes:

- **Type Safety**: Use TypeScript with automatic type inference via `src/types/global.d.ts` or inside the files themselves.and method overloads to ensure `NextRushRequest`, `NextRushResponse`, `RequestContext`, and `NextRush` types are inferred correctly without manual imports. **Never use `any` in user-facing APIs.**
- **Unified Plugin Architecture**: All features (routing, middleware, WebSocket, static files, templating) must be implemented as plugins under `src/plugins`, inheriting from `BasePlugin`. Eliminate separate `components` or other conflicting structures.
- **Express-Like DX**: Provide a familiar, simple API (`createApp`, `app.get`, `app.use`, `app.ws`, `app.static`, `app.render`) that hides complexity from developers.
- **Zero Dependencies**: Implement built-in features (e.g., body parsing, static file serving, templating) without external packages.
- **Clean Code**: Prioritize maintainability, readability, and performance. Use clear naming, concise files (~150-200 lines), and modular design. Avoid code duplication and inconsistent patterns.

## Context from Old Codebase

The old codebase at `/mnt/storage/project/MyExpress/NextRush_Src_Old/src` serves as a reference for feature parity. Before editing or creating files, **always cross-reference the old codebase** to ensure no features are skipped. Key files include:

- `application.ts`: Old monolithic logic (1239 lines). Now split into `src/core/application.ts` and plugins.
- `router.ts`: Old routing logic (1103 lines). Now in `src/plugins/router/router.plugin.ts`.
- `websocket-server.ts`: Old WebSocket logic. Now in `src/plugins/websocket/websocket.plugin.ts`.
- `response-enhancer.ts`, `static-files.ts`, `clean-template-engine.ts`, `built-in.ts`: Old utilities. Now modularized in `src/plugins`.

**Key Features to Preserve**:

- **Routing**: Support all HTTP methods (`get`, `post`, `put`, `delete`, `patch`, `head`, `options`, `all`) with Express-style (`req: NextRushRequest, res: NextRushResponse`) and context-style (`context: RequestContext`) handlers.
- **Middleware**: Global (`app.use`) and route-specific middleware (e.g., `cors`, `helmet`, custom).
- **WebSocket**: `app.ws` for WebSocket endpoints.
- **Static Files**: `app.static` for serving files with SPA support.
- **Templating**: `app.setViews` and `app.render` for template rendering.
- **Event System**: Event-driven architecture via `PluginRegistry`.

**Action**: Before modifying any file, verify feature parity with the old codebase and `/docs` (e.g., `API-REFERENCE.md`, `MIDDLEWARE.md`). If a feature exists, update it in the original file rather than creating a new one.

## Documentation Reference

The `/docs` directory contains Markdown files detailing functionality. Always consult these before generating code:

- **API-REFERENCE.md**: Public API signatures (`createApp`, `app.get`, `app.use`, etc.).
- **BODY-PARSER.md**, **BODY-PARSER-STATUS.md**: Body parsing middleware and status handling.
- **EVENT-DRIVEN-ARCHITECTURE.md**, **EVENT-SYSTEM.md**: Event system for plugin communication.
- **MIDDLEWARE.md**: Middleware patterns (Express-style and context-style).
- **REQUEST.md**, **RESPONSE.md**: `NextRushRequest` and `NextRushResponse` interfaces.
- **USER-MANUAL.md**: Setup and usage guidance.
- **WEBSOCKET.md**: WebSocket implementation details.

## File Structure Guidelines (Operational) You can follow your own structure, but it must follow the guidelines below and best practices.

The codebase must follow a clean, modular structure. **Do not create duplicate folders or files** (e.g., `src/components/static` and `src/components/static-files`). **Check for existing implementations before creating new files.** Use this structure:

```
src/
├── plugins/
│   ├── router/
│   │   ├── router.plugin.ts
│   │   └── route-matcher.ts
│   ├── websocket/
│   │   └── websocket.plugin.ts
│   ├── static-files/
│   │   └── static-files.plugin.ts
│   ├── template/
│   │   ├── template.plugin.ts
│   │   └── template-engine.ts
│   ├── body-parser/
│   │   └── body-parser.plugin.ts
│   ├── middleware/
│   │   ├── middleware.plugin.ts
│   │   └── presets.ts
│   ├── core/
│   │   ├── base-plugin.ts
│   │   └── plugin-manager.ts
│   └── index.ts
├── core/
│   ├── application.ts
│   ├── event-system.ts
│   ├── plugin-registry.ts
│   └── interfaces.ts
├── types/
│   ├── global.d.ts
│   ├── http.ts
│   ├── routing.ts
│   ├── websocket.ts
│   └── template.ts
├── errors/
│   ├── custom-errors.ts
│   ├── error-handler.ts
│   └── types.ts
├── utils/
│   ├── path-utils.ts
│   ├── compose.ts
│   └── template-engine.ts
├── examples/
│   ├── routing/
│   │   └── routing.test.ts
│   ├── middleware/
│   │   └── middleware.test.ts
│   └── websocket/
│       └── websocket.test.ts
└── index.ts
```

- **Plugins**: All features (routing, middleware, etc.) are implemented as plugins under `src/plugins`. Each plugin inherits from `BasePlugin` (`src/plugins/core/base-plugin.ts`).
- **No Components**: Eliminate `src/components`. Move all component logic to `src/plugins`.
- **Temporary Files**: For experimental or temporary implementations, use `t-<feature>.ts` (e.g., `t-router.ts`). Once finalized, merge into the original file (e.g., `router.plugin.ts`) and **delete the temporary file**.
- **Testing**: Place test files in `src/examples/<feature>/<feature>.test.ts` to keep them organized and separate from production code.
- **Core Logic**: Core application logic (e.g., `Application`, `PluginRegistry`) lives in `src/core`.

**Restriction**: Do not create duplicate files or folders. If a feature exists (e.g., in `router.plugin.ts`), update it instead of creating a new file (e.g., `router-new.ts`). Check the old codebase and `/docs` first.

## Coding Guidelines

1. **Type Safety**:

   - Use TypeScript with method overloads in `src/types/global.d.ts` to ensure proper type inference for `app.get`, `app.use`, `router.get`, etc. Example:
     ```typescript
     declare module 'nextrush' {
       interface NextRush {
         get(
           path: string,
           handler: (req: NextRushRequest, res: NextRushResponse) => void
         ): this;
         get(path: string, handler: (context: RequestContext) => void): this;
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
   - **Never use `any`** in user-facing APIs. Always use `NextRushRequest`, `NextRushResponse`, `RequestContext`, or `WebSocket`.
   - Ensure all public APIs are fully typed and infer types automatically without manual imports.

2. **Unified Plugin Architecture**:

   - All features are implemented as plugins inheriting from `BasePlugin`:

     ```typescript
     import { PluginRegistry } from '../../core/plugin-registry';
     import { Application } from '../../core/application';

     export abstract class BasePlugin {
       abstract name: string;
       protected registry: PluginRegistry;

       constructor(registry: PluginRegistry) {
         this.registry = registry;
       }

       abstract install(app: Application): void;
       abstract start(): void;
       abstract stop(): void;

       protected emit(event: string, ...args: any[]): void {
         this.registry.emit(event, ...args);
       }
     }
     ```

   - Example plugin (`src/plugins/router/router.plugin.ts`):

     ```typescript
     import { BasePlugin } from '../core/base-plugin';
     import { Application } from '../../core/application';
     import { NextRushRequest, NextRushResponse } from '../../types/http';

     export class RouterPlugin extends BasePlugin {
       name = 'Router';

       install(app: Application) {
         app.get = (
           path: string,
           handler: (req: NextRushRequest, res: NextRushResponse) => void
         ) => {
           this.registry.registerRoute('GET', path, handler);
           return app;
         };
         // Add other HTTP methods
       }

       start() {
         this.emit('router:started');
       }

       stop() {
         this.emit('router:stopped');
       }
     }
     ```

3. **Routing and Middleware**:

   - Support all HTTP methods with Express-style and context-style handlers. Use `src/plugins/middleware/middleware.plugin.ts` for middleware logic.
   - Convert Express-style to context-style internally using utilities in `src/utils/compose.ts`.
   - Example:
     ```typescript
     app.use(
       (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
         req.customHeader = 'X-NextRush';
         next();
       }
     );
     app.get('/api', (req: NextRushRequest, res: NextRushResponse) => {
       res.json({ data: req.body });
     });
     ```

4. **WebSocket**:

   - Implement `app.ws` in `src/plugins/websocket/websocket.plugin.ts` using the `ws` package (only dependency allowed if necessary).
   - Example:
     ```typescript
     app.ws('/chat', (socket: WebSocket) => {
       socket.send('Welcome!');
       socket.on('message', (data) => socket.send(`Received: ${data}`));
     });
     ```

5. **Static Files and Templating**:

   - Use `app.static` for serving files with SPA support (`src/plugins/static-files/static-files.plugin.ts`).
   - Use `app.setViews` and `app.render` for template rendering (`src/plugins/template/template.plugin.ts`).
   - Example:
     ```typescript
     app.static('/public', './public', { spa: true });
     app.setViews('./views');
     app.get('/template', (req: NextRushRequest, res: NextRushResponse) => {
       res.render('index.html', { title: 'NextRush' });
     });
     ```

6. **Clean Code Practices**:

   - Use clear JSDoc comments for public APIs.
   - Keep files concise (~150-300 lines) by splitting logic into plugins.
   - Use meaningful names (e.g., `registerRoute` instead of `add`).
   - Validate types with `npx tsc --noEmit` and `npx dtslint` in CI.
   - **No Duplication**: Before implementing a feature, check if it exists in the old codebase or current files. Update existing files instead of creating new ones.

7. **Testing**:

   - Place tests in `src/examples/<feature>/<feature>.test.ts` (e.g., `src/examples/routing/routing.test.ts`).
   - Group tests by feature to keep them organized.
   - Example:

     ```typescript
     // src/examples/routing/routing.test.ts
     import { createApp } from '../../index';

     describe('Routing', () => {
       it('handles GET requests', () => {
         const app = createApp();
         app.get('/test', (req, res) => res.json({ message: 'OK' }));
         // Test logic
       });
     });
     ```

8. **Temporary Files**:

   - For experimental implementations, use `t-<feature>.ts` (e.g., `t-router.ts`).
   - Once finalized, merge into the original file (e.g., `router.plugin.ts`) and **delete the temporary file**.
   - **Never leave unused files** in the codebase.

9. **Core Logic**:

- Core application logic (e.g., `Application`, `PluginRegistry`) lives in `src/core`.
- Ensure the public API (`createApp`, `app.get`, etc.) is simple and intuitive.
- Use OOP inheritance and abstract classes (e.g., `BasePlugin`) to encapsulate complexity.

## Copilot Workflow Guidelines

1. **Check Before Modifying**:

   - Before editing or creating a file, check the old codebase (`/mnt/storage/project/MyExpress/NextRush_Src_Old/src`) and `/docs` to ensure feature parity.
   - Verify if the feature exists in the current codebase. Update existing files instead of creating new ones.
   - Example: If implementing routing, update `src/plugins/router/router.plugin.ts` instead of creating `router-new.ts`.

2. **Prevent Duplication**:

   - **Do not create duplicate files or folders** (e.g., `src/components/static` and `src/components/static-files`).
   - If a feature is implemented differently (e.g., 200 lines in `x.ts` and another version in `y.ts`), consolidate into one file. Use temporary files (`t-<feature>.ts`) for experiments, then merge and delete.

3. **Smart Modularity**:

   - Avoid DRY if it sacrifices clarity. Instead, use plugins to encapsulate reusable logic.
   - Example: Middleware logic should live in `src/plugins/middleware/middleware.plugin.ts`, not scattered across `src/middleware` and `src/components`.

4. **Type Safety**:

   - Use method overloads in `src/types/global.d.ts` to ensure `app.get`, `app.use`, `router.get`, etc., infer correct types.
   - **Never break type inference**. Ensure developer-facing APIs are fully typed with `NextRushRequest`, `NextRushResponse`, etc.
   - Example:
     ```typescript
     app.use(
       (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
         res.setHeader('X-Powered-By', 'NextRush');
         next();
       }
     );
     ```

5. **Freedom with Restrictions**:

   - Copilot has freedom to design the folder structure within `src/plugins`, but must follow the provided structure and avoid unused or duplicate files.
   - Example: If a new feature is needed, create a new plugin under `src/plugins/<feature>`, but check for existing implementations first.

6. **Hide Complexity**:

   - Use OOP inheritance and abstract classes (e.g., `BasePlugin`) to encapsulate complexity.
   - Example: `PluginRegistry` handles plugin lifecycle and events, so developers only interact with `app.get`, `app.use`, etc.
   - Ensure the public API (`createApp`, `app.get`, etc.) is simple and intuitive.

7. **Improving Developer Experience**:

- Provide clear documentation and examples for all public APIs.
- Implement helpful error messages and type hints to guide developers.
- Use JSDoc comments to explain complex logic and public methods.

## Example Prompts for Copilot

- **Routing**: "Update `src/plugins/router/router.plugin.ts` to support `app.get` with type-safe `NextRushRequest` and `NextRushResponse`. Check `/mnt/storage/project/MyExpress/NextRush_Src_Old/src/router.ts` for feature parity."
- **Middleware**: "Implement a middleware plugin in `src/plugins/middleware/middleware.plugin.ts` supporting Express-style and context-style handlers. Ensure type safety with `global.d.ts`."
- **WebSocket**: "Update `src/plugins/websocket/websocket.plugin.ts` to support `app.ws`. Reference `/mnt/storage/project/MyExpress/NextRush_Src_Old/src/websocket-server.ts`."
- **Testing**: "Create a test in `src/examples/routing/routing.test.ts` for `app.get` with a JSON response."

## Notes

- **Always cross-reference** the old codebase and `/docs` before modifying files.
- **Never use `any`** in user-facing APIs. Rely on `src/types/global.d.ts` for type inference.
- **Consolidate duplicate code** by updating existing files, not creating new ones.
- **Clean up after refactoring**: Delete temporary files (`t-<feature>.ts`) and unused folders.
- **Test rigorously** using `npx tsc --noEmit` and `npx dtslint`. Place tests in `src/examples`.

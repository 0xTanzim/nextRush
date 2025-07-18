# GitHub Copilot Instructions for NextRush Project

## Project Overview

You are an expert in TypeScript, Node.js, and building web frameworks. Your task is to develop **NextRush**, a modular, type-safe, zero-dependency (where feasible), and developer-friendly web framework that surpasses Express.js in simplicity and power. NextRush emphasizes:

- **Type Safety**: Use TypeScript with automatic type inference via `src/types/global.d.ts` or inside the files themselves and method overloads to ensure `NextRushRequest`, `NextRushResponse`, `RequestContext`, and `NextRush` types are inferred correctly without manual imports. **Never use `any` in user-facing APIs.**
- **Unified Plugin Architecture**: All features (routing, middleware, WebSocket, static files, templating) must be implemented as plugins under `src/plugins`, inheriting from `BasePlugin`. Eliminate separate `components` or other conflicting structures.
- **Express-Like DX**: Provide a familiar, simple API (`createApp`, `app.get`, `app.use`, `app.ws`, `app.static`, `app.render`) that hides complexity from developers.
- **Zero Dependencies**: Implement built-in features (e.g., body parsing, static file serving, templating) without external packages.
- **Enterprise-Grade Quality**: Follow industry-leading standards inspired by Fastify's performance, Hapi's security, NestJS's architecture, and Koa's elegance.
- **Clean Code**: Prioritize maintainability, readability, and performance. Use clear naming, concise files (~150-300 lines), and modular design. Avoid code duplication and inconsistent patterns.

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

The `/docs` directory contains Markdown files detailing functionality. **Always consult these before generating code** to ensure alignment:

- `API-REFERENCE.md`: Public API signatures (`createApp`, `app.get`, `app.use`, `app.usePreset`, etc.).
- `BODY-PARSER-API.md`, `BODY-PARSER-GUIDE.md`, `BODY-PARSER-ULTIMATE.md`: Body parsing middleware and implementation details.
- `EVENT-DRIVEN-ARCHITECTURE.md`: Event system for plugin communication.
- `MIDDLEWARE.md`: Middleware patterns, including `app.usePreset` and composition.
- `REQUEST.md`, `RESPONSE.md`: `NextRushRequest` and `NextRushResponse` interfaces.
- `USER-MANUAL.md`: Setup and usage guidance.
- `WEBSOCKET.md`: WebSocket implementation details, including room management.
- `TEMPLATE-ENGINE.md`, `TEMPLATE-ENGINE-GUIDE.md`: Templating and routing status.

**Action**: After implementing features, update `/docs` to reflect the plugin-based architecture and ensure 100% feature coverage.

## Current Project State Analysis

### ✅ **Completed Core Features** (Based on semantic analysis)

#### **Plugin Architecture** (100% Complete)
- ✅ `BasePlugin` abstract class with unified interface
- ✅ `PluginRegistry` for lifecycle management
- ✅ Event-driven communication system
- ✅ All 5 core plugins implemented:
  - `RouterPlugin`: HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, ALL)
  - `MiddlewarePlugin`: Global and route-specific middleware with presets
  - `StaticFilesPlugin`: File serving with SPA support
  - `WebSocketPlugin`: Zero-dependency WebSocket with rooms
  - `TemplatePlugin`: Multi-syntax template engine
  - `BodyParserPlugin`: Ultimate body parsing with file uploads

#### **Type Safety** (95% Complete)
- ✅ Full TypeScript integration with method overloads
- ✅ No `any` usage in public APIs
- ✅ Automatic type inference for `app.get`, `app.use`, etc.
- ✅ Context-style and Express-style handler support
- 🔄 Global type definitions optimization needed

#### **Zero Dependencies** (100% Complete)
- ✅ WebSocket implementation using native Node.js APIs
- ✅ Template engine with multiple syntax support
- ✅ Body parser with multipart/file upload support
- ✅ Static file server with compression and caching

#### **Performance Optimizations** (90% Complete)
- ✅ Plugin lazy loading and caching
- ✅ Streaming support for large responses
- ✅ Memory-conscious WebSocket implementation
- ✅ Efficient route matching algorithms

### 🔄 **Framework Analysis vs. Industry Leaders**

Based on research from Fastify, Hapi, NestJS, and Koa, NextRush adopts best practices:

#### **From Fastify** (Performance Leader)
- ✅ Schema-based validation architecture
- ✅ Plugin system for extensibility
- ✅ High-performance request/response handling
- 🔄 JSON schema integration for validation (planned)

#### **From Hapi** (Security Leader)
- ✅ Built-in security defaults
- ✅ Comprehensive plugin lifecycle
- ✅ Predictable middleware execution order
- ✅ Zero external dependencies for core features

#### **From NestJS** (Architecture Leader)
- ✅ Dependency injection patterns (via plugin registry)
- ✅ Modular architecture with clear separation
- ✅ TypeScript-first design
- 🔄 Decorator support (future enhancement)

#### **From Koa** (Simplicity Leader)
- ✅ Context-style handlers alongside Express compatibility
- ✅ Middleware cascading and composition
- ✅ Clean API surface with minimal cognitive overhead

## File Structure Guidelines (Operational)

The codebase follows a clean, modular structure. **Do not create duplicate folders or files** (e.g., `src/components/static` and `src/components/static-files`). **Check for existing implementations before creating new files.** The current structure is:

```
src/
├── plugins/                    # 🔌 ALL FEATURES AS PLUGINS
│   ├── body-parser/
│   │   └── body-parser.plugin.ts
│   ├── middleware/
│   │   ├── middleware.plugin.ts
│   │   ├── presets.ts
│   │   ├── built-in.ts
│   │   └── composition.ts
│   ├── router/
│   │   ├── router.plugin.ts
│   │   └── route-matcher.ts
│   ├── static-files/
│   │   └── static-files.plugin.ts
│   ├── template/
│   │   ├── template.plugin.ts
│   │   ├── ultimate-template-engine.ts
│   │   └── index.ts
│   ├── websocket/
│   │   └── websocket.plugin.ts
│   ├── core/                   # 🏗️ PLUGIN SYSTEM CORE
│   │   ├── base-plugin.ts
│   │   ├── plugin-manager.ts
│   │   ├── plugin.interface.ts
│   │   └── simple-registry.ts
│   ├── clean-plugins.ts        # 🎯 UNIFIED PLUGIN CREATION
│   └── index.ts
├── core/                       # 🚀 APPLICATION CORE
│   ├── app/
│   │   ├── application.ts      # Main app class
│   │   ├── base-component.ts
│   │   ├── component-manager.ts
│   │   └── plugin-registry.ts
│   ├── enhancers/
│   │   ├── request-enhancer.ts
│   │   └── response-enhancer.ts
│   ├── types/
│   │   └── interfaces.ts
│   ├── event-system.ts
│   ├── interfaces.ts
│   └── index.ts
├── errors/                     # 🛡️ ERROR HANDLING
│   ├── custom-errors.ts
│   ├── error-handler.ts
│   ├── types.ts
│   └── index.ts
├── helpers/                    # 🔧 UTILITY FUNCTIONS
│   ├── type-helpers.ts
│   └── index.ts
├── types/                      # 📝 TYPE DEFINITIONS
│   ├── global.d.ts            # 🎯 AUTO TYPE INFERENCE
│   ├── http.ts
│   ├── routing.ts
│   ├── template.ts
│   ├── websocket.ts
│   ├── common.ts
│   ├── component-errors.ts
│   ├── express.ts
│   └── index.ts
├── utils/                      # ⚙️ SHARED UTILITIES
│   ├── path-utils.ts
│   ├── template-engine.ts
│   └── compose.ts
├── examples/                   # 🧪 TESTING & DEMOS
│   ├── template/
│   │   ├── template.test.ts
│   │   ├── debug-loop.ts
│   │   ├── final-verification.ts
│   │   ├── production-demo.ts
│   │   ├── quick-test.ts
│   │   ├── server-test.ts
│   │   └── working-demo.ts
│   ├── routing/
│   │   └── routing.test.ts
│   ├── middleware/
│   └── websocket/
├── http/                       # 📊 LEGACY (TO BE MIGRATED)
├── routing/                    # 📊 LEGACY (TO BE MIGRATED)
├── middleware/                 # 📊 LEGACY (TO BE MIGRATED)
├── templating/                 # 📊 LEGACY (TO BE MIGRATED)
└── index.ts                    # 🏁 MAIN ENTRY POINT
```

### **Key Principles**:
- **Plugins**: All features (routing, middleware, etc.) are implemented as plugins under `src/plugins`. Each plugin inherits from `BasePlugin` (`src/plugins/core/base-plugin.ts`).
- **No Components**: Eliminate `src/components`. Move all component logic to `src/plugins`.
- **Legacy Migration**: Folders like `http/`, `routing/`, `middleware/`, and `templating/` are legacy and should be migrated to plugins.
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

   - Support all HTTP methods with Express-style and context-style handlers in `src/plugins/router/router.plugin.ts`.
   - Implement middleware logic in `src/plugins/middleware/middleware.plugin.ts`, including `app.usePreset` for presets (`development`, `production`, `fullFeatured`, etc.).
   - Use `src/utils/compose.ts` for middleware composition and Express-to-context conversion.
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

   - Implement `app.ws` in `src/plugins/websocket/websocket.plugin.ts` using Node's built-in `ws` module. No external dependencies.
   - Support WebSocket endpoints with type-safe handlers.
   - Support room management and authentication as per `WEBSOCKET.md`.

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

6. **Body Parsing**:

   - Implement `Ultimate Body Parser` in `src/plugins/body-parser/body-parser.plugin.ts` for JSON, URL-encoded, multipart, and file uploads with security validations.
   - Migrate logic from `http/parsers/` and `http/request/` to `src/plugins/body-parser/`.
   - Example:
     ```typescript
     app.post('/upload', (req: NextRushRequest, res: NextRushResponse) => {
       const file = req.file('avatar');
       res.json({ file: file.filename });
     });
     ```

7. **Performance & Security Best Practices**:

   - **Fastify-inspired**: Use schema-based validation, plugin lazy loading, streaming responses
   - **Hapi-inspired**: Security defaults, predictable middleware execution, comprehensive error handling
   - **NestJS-inspired**: Dependency injection patterns, modular architecture, decorator support (future)
   - **Koa-inspired**: Context-style handlers, middleware cascading, minimal cognitive overhead

   - Example performance optimization:
     ```typescript
     // Plugin lazy loading
     const lazyPlugin = () => import('./heavy-plugin').then(m => m.default);

     // Streaming responses
     app.get('/large-data', (req, res) => {
       const stream = createReadableStream();
       res.setHeader('Content-Type', 'application/json');
       stream.pipe(res);
     });
     ```

8. **Clean Code Practices**:

   - Use clear JSDoc comments for public APIs:
     ```typescript
     /**
      * Registers a GET route with type-safe request and response.
      * @param path The route path (e.g., '/api/users/:id')
      * @param handler The request handler
      * @example
      * app.get('/users/:id', (req, res) => {
      *   res.json({ user: req.params.id });
      * });
      */
     get(path: string, handler: (req: NextRushRequest, res: NextRushResponse) => void): this;
     ```
   - Keep files concise (~150-300 lines) by splitting logic into plugins.
   - Use meaningful names (e.g., `registerRoute` instead of `add`).
   - Validate types with `npx tsc --noEmit` and `npx dtslint` in CI.
   - **No Duplication**: Before implementing a feature, check if it exists in the old codebase or current files. Update existing files instead of creating new ones.

9. **Testing**:

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

10. **Temporary Files**:

   - For experimental implementations, use `t-<feature>.ts` (e.g., `t-router.ts`).
   - Once finalized, merge into the original file (e.g., `router.plugin.ts`) and **delete the temporary file**.
   - Use `t-<feature>.ts` (e.g., `t-websocket.ts`) in the relevant plugin folder for experimental implementations.
   - Merge into the main plugin file (e.g., `websocket.plugin.ts`) and delete temporary files.
   - Example: Create `src/plugins/websocket/t-room-management.ts`, then merge into `websocket.plugin.ts` and delete.

   - **Never leave unused files** in the codebase.

11. **Core Logic**:
    - Core logic (`Application`, `PluginRegistry`, `EventSystem`) lives in `src/core/`.
    - Ensure the public API (`createApp`, `app.get`, etc.) is simple and intuitive.
    - Use OOP inheritance and abstract classes (e.g., `BasePlugin`) to encapsulate complexity.
    - Avoid adding unnecessary complexity to the core logic. Keep it focused on the essential features and functionality.
    - Proper use of OOP principles to encapsulate complexity and provide a clean, intuitive API for developers.
    - Abstraction of complex logic into plugins and utility functions to keep the core application logic simple and maintainable.

12. **Agent Configuration Integration**:
    - Leverage VS Code's TypeScript language features for enhanced development experience
    - Use proper JSON schema validation for configuration files
    - Implement workspace-specific settings for optimal development workflow
    - Support both desktop and web extension environments
    - Provide comprehensive IntelliSense and autocomplete functionality

## Developer Experience

- Prioritize developer experience by providing clear documentation, examples, and a consistent coding style.
- Encourage collaboration and knowledge sharing among developers to foster a positive and productive work environment.
- Implement helpful error messages and type hints to guide developers.
- Use JSDoc comments to explain complex logic and public methods.
- Provide clear documentation and examples for all public APIs.
- Use consistent naming conventions and coding styles across the codebase.
- Use TypeScript's type system to provide clear and helpful type hints for developers.
- Make sure to document any complex logic or patterns in the codebase to help developers understand the design decisions.
- Make sure TypeScript's types properly infer types.

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

8. **Migrate Redundant Folders**:

   - Migrate logic from `http/`, `routing/`, `middleware/`, and `templating/` to their respective plugins under `src/plugins/`.
   - Example: Move `http/parsers/ultimate-body-parser.ts` to `src/plugins/body-parser/ultimate-body-parser.ts` and delete `http/`.
   - Log migrations in `docs/CHANGELOG.md`.

9. **Codebase Cleanup**:
   - Use tools like `code-cleaner` to identify and remove duplicate files (e.g., `http/ultimate-body-parser.ts` and `plugins/body-parser/ultimate-body-parser.ts`).
   - Delete temporary files (`t-<feature>.ts`) after merging.
   - Remove redundant folders (`http/`, `routing/`, `middleware/`, `templating/`) after migration.
   - Log changes in `docs/CHANGELOG.md`.

## Example Prompts for Copilot

- **Routing**: "Update `src/plugins/router/router.plugin.ts` to support `app.get` with type-safe `NextRushRequest` and `NextRushResponse`. Check `/mnt/storage/project/MyExpress/NextRush_Src_Old/src/router.ts` for feature parity."
- **Middleware**: "Implement a middleware plugin in `src/plugins/middleware/middleware.plugin.ts` supporting Express-style and context-style handlers. Ensure type safety with `global.d.ts`."
- **WebSocket**: "Update `src/plugins/websocket/websocket.plugin.ts` to support `app.ws`. Reference `/mnt/storage/project/MyExpress/NextRush_Src_Old/src/websocket-server.ts`."
- **Testing**: "Create a test in `src/examples/routing/routing.test.ts` for `app.get` with a JSON response."

## Notes

- **Cross-Reference**: Always check the old codebase and `/docs` before modifying files to ensure feature parity.
- **No `any`**: Use `NextRushRequest`, `NextRushResponse`, `RequestContext`, or `WebSocket` in user-facing APIs.
- **Never use `any`** in user-facing APIs. Rely on `src/types/global.d.ts` for type inference.
- **Consolidate duplicate code** by updating existing files, not creating new ones.
- **Clean up after refactoring**: Delete temporary files (`t-<feature>.ts`) and unused folders.
- **Test rigorously** using `npx tsc --noEmit` and `npx dtslint`. Place tests in `src/examples`.
- **Documentation**: Update `/docs` after implementing features to reflect the plugin-based architecture.

---

## Advanced Agent Configuration & Development Tools

This section provides comprehensive VS Code agent configuration for optimal NextRush development experience, inspired by industry-leading frameworks and development practices.

### Agent Capabilities Matrix

| Capability | Status | Priority | Implementation |
|------------|--------|----------|----------------|
| **TypeScript Integration** | ✅ Active | Critical | VS Code native + custom schemas |
| **Plugin Architecture Support** | ✅ Active | Critical | Custom IntelliSense + snippets |
| **Performance Monitoring** | 🔄 Planned | High | Webpack bundle analyzer + metrics |
| **Security Validation** | 🔄 Planned | High | Custom linting rules + audit tools |
| **Auto-completion** | ✅ Active | Critical | Enhanced TypeScript definitions |
| **Error Detection** | ✅ Active | Critical | Multi-layer validation system |
| **Refactoring Support** | 🔄 Planned | Medium | Smart rename + import management |
| **Testing Integration** | 🔄 Planned | Medium | Jest + coverage reporting |


#### Based on Research from Leading Frameworks:

1. **Fastify-inspired Development Environment**:
   - High-performance development server with hot reload
   - Schema-based validation during development
   - Plugin discovery and validation
   - Performance metrics integration

2. **Hapi-inspired Security Features**:
   - Security-first development warnings
   - Dependency vulnerability scanning
   - Code security analysis integration
   - Secure coding practice suggestions

3. **NestJS-inspired Architecture Support**:
   - Dependency injection visualization
   - Module dependency graph
   - Decorator syntax support
   - Advanced IntelliSense for architectural patterns

4. **Koa-inspired Simplicity**:
   - Minimal configuration overhead
   - Context-aware suggestions
   - Middleware flow visualization
   - Clean error reporting


This configuration provides:
- **Complete TypeScript integration** with enhanced IntelliSense
- **Plugin-aware development** with custom snippets and validation
- **Performance monitoring** and optimization tools
- **Security-first development** practices
- **Framework-specific tooling** inspired by industry leaders
- **Advanced debugging** capabilities for complex plugin architectures
- **Automated quality assurance** with comprehensive testing integration

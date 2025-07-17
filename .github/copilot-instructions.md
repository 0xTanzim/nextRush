# GitHub Copilot Instructions for NextRush Project

## Project Overview

You are an expert in TypeScript, Node.js, and building web frameworks similar to Express.js. Your task is to develop the **NextRush** framework, a modular, type-safe, and developer-friendly web framework. The project emphasizes:

- **Type Safety**: Use TypeScript with automatic type inference via `src/types/global.d.ts` to avoid manual imports of `NextRushRequest`, `NextRushResponse`, and `RequestContext`.
- **Modularity**: Organize code into components (e.g., `RouterComponent`, `WebSocketComponent`) that inherit from `BaseComponent` in `src/core/base-component.ts`.
- **Express-Like DX**: Provide a familiar API for routing (`app.get`, `app.post`, `app.use`, etc.), middleware, WebSocket (`app.ws`), static file serving (`app.static`), and template rendering (`app.render`).
- **Clean Code**: Follow best practices for maintainability, readability, and performance, avoiding `any` types in user-facing code.

## Context from Old Codebase

The old codebase is located at `/mnt/storage/project/MyExpress/NextRush_Src_Old/src`. Use it as a reference for previous implementations, but adapt to the new architecture:

- **Files to Reference**:
  - `application.ts`: Old monolithic application logic (previously 1239 lines). Now split into modular components (~120-180 lines each) like `RouterComponent`, `WebSocketComponent`, `TemplateComponent`, `StaticComponent`.
  - `router.ts`: Old routing logic (1103 lines). Now implemented in `src/components/router/router.component.ts` with `RouteBuilder` and `RouteStore`.
  - `websocket-server.ts`: Old WebSocket implementation. Now in `src/components/websocket/websocket.component.ts`.
  - `response-enhancer.ts`, `static-files.ts`, `clean-template-engine.ts`, `built-in.ts`: Old implementations for response utilities, static file serving, templating, and middleware. Now modularized in `src/components`.
- **Key Features to Preserve**:
  - Routing: Support for all HTTP methods (`get`, `post`, `put`, `delete`, `patch`, `head`, `options`, `all`) with Express-style and context-style handlers.
  - Middleware: Support for global (`app.use`) and route-specific middleware (e.g., `cors`, `helmet`, custom middleware).
  - WebSocket: `app.ws` for WebSocket endpoints.
  - Static Files: `app.static` for serving files with SPA support.
  - Templating: `app.setViews` and `app.render` for rendering templates.
  - Event System: Event-driven architecture for component communication.

When generating code, compare with the old codebase to ensure feature parity, but prioritize the new modular structure and type safety.

## Documentation Reference

The `/docs` directory contains Markdown files describing the intended functionality. Use these to understand the API and feature requirements:

- **API-REFERENCE.md**: Details the public API (`createApp`, `app.get`, `app.use`, etc.) and expected signatures.
- **BODY-PARSER.md**, **BODY-PARSER-STATUS.md**: Describes body parsing middleware (`app.use(bodyParser.json())`) and status handling.
- **EVENT-DRIVEN-ARCHITECTURE.md**, **EVENT-SYSTEM.md**: Outlines the event system for component communication (e.g., `PluginRegistry` events).
- **MIDDLEWARE.md**: Explains middleware structure, including Express-style (`req, res, next`) and context-style (`context, next`).
- **REQUEST.md**, **RESPONSE.md**: Defines `NextRushRequest` and `NextRushResponse` interfaces and methods (e.g., `res.json`, `res.status`).
- **USER-MANUAL.md**: Provides user-facing guidance on setup and usage.
- **WEBSOCKET.md**: Describes WebSocket implementation (`app.ws`).

When generating code, consult these files to ensure alignment with documented behavior. For example, check `MIDDLEWARE.md` for middleware implementation details or `WEBSOCKET.md` for WebSocket handler signatures.

## Coding Guidelines

1. **TypeScript Usage**:

   - Always use TypeScript for type safety.
   - Leverage `src/types/global.d.ts` for automatic type inference of `Application` methods (e.g., `app.get`, `app.post`, `app.use`, `app.ws`) or you can use overloads for smarter type inference. 
   - Avoid `any` types in user-facing code. Use specific types like `NextRushRequest`, `NextRushResponse`, `RequestContext`, or `WebSocket`.
   - Example:
     ```typescript
     app.get('/example', (req, res) => {
       res.json({ message: 'Hello' }); // req: NextRushRequest, res: NextRushResponse
     });
     app.get('/context', (context) => {
       context.response.json({ message: 'Context' }); // context: RequestContext
     });
     ```

2. **Modular Architecture**:

   - Organize code into components under `src/components` (e.g., `router.component.ts`, `websocket.component.ts`).
   - Each component inherits from `BaseComponent` (`src/core/base-component.ts`) and implements `install`, `start`, and `stop` lifecycle methods.
   - Use `PluginRegistry` (`src/core/plugin-registry.ts`) for dynamic component registration.
   - Example component structure:
     ```typescript
     import { BaseComponent } from '../core/base-component';
     export class RouterComponent extends BaseComponent {
       name = 'Router';
       install(app: Application) {
         // Bind routing methods
       }
       start() {
         /* Initialize */
       }
       stop() {
         /* Cleanup */
       }
     }
     ```

3. **Routing and Middleware**:

   - Support all HTTP methods with both Express-style and context-style handlers, as defined in `src/core/methods/http-methods.ts`.
   - Convert Express-style middleware/handlers to context-style using `convertHandler` and `convertMiddleware` from `http-methods.ts`.
   - Example:
     ```typescript
     app.use(cors());
     app.get('/api', (req, res) => res.json({ data: req.body }));
     app.post('/context', (context) =>
       context.response.json({ data: context.body })
     );
     ```

4. **WebSocket**:

   - Implement `app.ws` for WebSocket endpoints, using `WebSocket` from the `ws` package.
   - Example:
     ```typescript
     app.ws('/chat', (socket) => {
       socket.send('Welcome!');
       socket.on('message', (data) => socket.send(`Received: ${data}`));
     });
     ```

5. **Static Files and Templating**:

   - Use `app.static` for serving files from a directory (e.g., `./public`) with SPA support.
   - Use `app.setViews` and `app.render` for template rendering from a directory (e.g., `./views`).
   - Example:
     ```typescript
     app.static('/public', './public', { spa: true });
     app.setViews('./views');
     app.get('/template', (req, res) =>
       res.render('index.html', { title: 'NextRush' })
     );
     ```

6. **Clean Code Practices**:
   - Write clear, concise JSDoc comments for public APIs.
   - Use meaningful variable/function names (e.g., `addRoute` instead of `add`).
   - Keep files small (~150-180 lines) by splitting logic into components.
   - Validate types with `dtslint` in CI.

## File and Directory Context

- **Old Codebase**: `/mnt/storage/project/MyExpress/NextRush_Src_Old/src`
  - Use for reference to ensure feature parity (e.g., routing, middleware, WebSocket).
  - Compare old `application.ts` with new `src/core/application.ts` to simplify logic.
- **Documentation**: `/docs`
  - Reference `API-REFERENCE.md` for API signatures.
  - Use `MIDDLEWARE.md` for middleware patterns.
  - Check `WEBSOCKET.md` for WebSocket implementation details.
- **New Code Structure**:
  - `src/index.ts`: Public API (`createApp`, `cors`, `helmet`).
  - `src/core/application.ts`: Main `Application` class.
  - `src/core/base-component.ts`: Base class for components.
  - `src/core/plugin-registry.ts`: Manages component registration.
  - `src/components/router/router.component.ts`: Routing logic.
  - `src/components/websocket/websocket.component.ts`: WebSocket logic.
  - `src/types/global.d.ts`: Type augmentation for `Application`.

## Example Prompts for Copilot

When using Copilot, use these prompts to generate code aligned with NextRush:

- **Routing**: "Write a TypeScript route handler for `app.get('/users')` that returns a JSON response using `NextRushResponse`."
- **Middleware**: "Create a custom middleware in TypeScript for NextRush that adds a custom header, compatible with `app.use`."
- **WebSocket**: "Generate a WebSocket handler for `app.ws('/chat')` that sends and receives messages."
- **Component**: "Write a TypeScript `RouterComponent` class that extends `BaseComponent` and implements routing for NextRush."
- **Type Safety**: "Ensure all route handlers use types from `global.d.ts` without manual imports."

## Notes

- Always reference `/mnt/storage/project/MyExpress/NextRush_Src_Old/src` for old implementations but prioritize the new modular structure.
- Use `/docs` Markdown files to understand feature requirements and API details.
- Avoid generating code that requires manual imports of `NextRushRequest`, `NextRushResponse`, or `RequestContext`—rely on `global.d.ts`.
- If unsure about a feature, check `API-REFERENCE.md` or `USER-MANUAL.md` for guidance.
- Test generated code with `npx tsc --noEmit` and `npx dtslint` to ensure type safety.

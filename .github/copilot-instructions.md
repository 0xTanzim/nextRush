# GitHub Copilot Instructions for NextRush Project

## Project Overview

You are an expert in TypeScript, Node.js, and web framework development, tasked with advancing **NextRush**, a modular, type-safe, and developer-friendly web framework designed to surpass Express.js in simplicity, power, and maintainability. NextRush is a production-ready TypeScript-based alternative for building APIs, web applications, and real-time systems, preparing for npm publication and community adoption. Key principles include:

- **Type Safety**: Utilize TypeScript with method overloads and type inference via `src/types/global.d.ts`, ensuring `NextRushRequest`, `NextRushResponse`, `RequestContext`, and `NextRush` types are inferred without manual imports. **Prohibit the use of `any` in user-facing APIs.**
- **Unified Plugin Architecture**: All features (routing, middleware, WebSocket, static files, templating) must be implemented as plugins under `src/plugins/`, inheriting from `BasePlugin`. No legacy `components` or separate structures are permitted.
- **Express-Like Developer Experience (DX)**: Maintain a familiar, intuitive API (`createApp`, `app.get`, `app.use`, `app.ws`, `app.static`, `app.render`) that abstracts complexity.
- **Zero Dependencies**: Leverage built-in Node.js APIs (e.g., `http`, `url`, `stream`, `zlib`) for core functionality to minimize external libraries.
- **Enterprise-Grade Quality**: Adhere to standards inspired by Fastify (performance), Hapi (security), NestJS (architecture), and Koa (elegance).
- **Clean Code**: Prioritize maintainability, readability, and performance with concise files (150-450 lines), modular design, zero duplication, and optimized algorithms.

### Project Details

- **Purpose**: NextRush aims to provide a lightweight, type-safe framework for developers building RESTful APIs, web apps, and real-time applications, emphasizing extensibility via plugins.
- **Version**: Pre-1.0.0, targeting a stable 1.0.0 release post-npm testing.
- **Unique Features**: Enhanced request/response enhancers, unified plugin system, event-driven architecture, and zero-dependency implementations.
- **Target Audience**: Node.js developers seeking a modern, type-safe alternative to Express.js with built-in advanced features.
- **Critical Issues**: Poor benchmark results and bad developer experience due to unoptimized code, lack of error handling, and duplicate files. Copilot must focus on fixing these issues.

## Current Project State

### File Structure

```
MyExpress/
├── dist/                  # Compiled output
├── docs/                  # Markdown documentation
├── examples/              # Test and demo files for each feature
│   ├── routing/
│   ├── middleware/
│   ├── websocket/
│   └── template/
├── public/                # Static files for serving
├── scripts/               # Shell scripts for build and utilities
├── src/                   # Source code
│   ├── core/             # Application core logic
│   │   ├── app/         # Application class and registry
│   │   ├── enhancers/   # Request/response enhancers
│   │   ├── types/       # Core interfaces
│   │   ├── event-system.ts
│   │   └── index.ts
│   ├── errors/           # Error handling
│   ├── helpers/          # Utility functions
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
│   ├── types/            # Type definitions
│   ├── utils/            # Shared utilities
│   └── index.ts          # Main entry point
├── benchmark-results.json
├── CODEBASE-ANALYSIS-REPORT.md
├── LICENSE
├── package.json
├── PERFORMANCE-ANALYSIS.md
├── PERFORMANCE-SUMMARY.md
├── pnpm-lock.yaml
├── README.md
├── tsconfig.build.json
├── tsconfig.json
├── tsconfig.tsbuildinfo
```

### Completed Features

- Plugin-based architecture with `BasePlugin` and `PluginRegistry`.
- Core plugins: `RouterPlugin`, `MiddlewarePlugin`, `StaticFilesPlugin`, `WebSocketPlugin`, `TemplatePlugin`, `BodyParserPlugin`.
- Type-safe APIs with `NextRushRequest`, `NextRushResponse`, and `RequestContext`.
- Zero-dependency implementations for WebSocket, templating, and body parsing.
- Documentation in `docs/` covering all features.

### Next-Level Goals

- Address critical performance issues identified in `PERFORMANCE-ANALYSIS.md` and `benchmark-results.json`.
- Prepare for npm publication with a stable API (`createApp`, `createRouter`).
- Implement comprehensive unit tests in `examples/` with 90%+ coverage.
- Optimize bundle size, route matching, and startup time.
- Enhance documentation for community use (e.g., website integration, OpenAPI specs).
- Support ongoing maintenance, contributions, and future enhancements (e.g., GraphQL, CLI).

## Critical Issues to Address

- **Poor Benchmark Results**: Optimize code to improve request throughput, reduce latency, and minimize memory usage. Focus on efficient route matching, lazy loading, and streaming.
- **Bad Developer Experience**: Simplify APIs, improve error messages, and ensure consistent type inference. Eliminate duplicate files and confusing legacy code.
- **Error Handling**: Implement robust error handling in all plugins and core logic to prevent crashes and provide meaningful feedback.

## Best Practices

### 1. Code Quality

- Use JSDoc for all public APIs to improve readability and tooling support.
  ```typescript
  /**
   * Creates a new NextRush application instance.
   * @param options Configuration options for the application
   * @returns Application instance
   */
  export function createApp(options?: ApplicationOptions): Application {}
  ```
- Enforce consistent formatting with `npx eslint` and `npx prettier` in CI pipelines.
- Use smart data structures (e.g., `Map` for route storage, `Set` for unique middleware) to optimize performance.

### 2. Testing

- Achieve 90%+ code coverage with Jest or Vitest in `examples/<feature>/<feature>.test.ts`.
- Include edge cases (e.g., invalid routes, large file uploads, malformed JSON).

  ```typescript
  // examples/body-parser/body-parser.test.ts
  import { createApp } from '../../src/index';

  describe('Body Parser', () => {
    it('parses JSON body', async () => {
      const app = createApp();
      app.post('/test', (req, res) => res.json(req.body));
      // Test logic
    });
    it('handles malformed JSON', async () => {
      const app = createApp();
      app.post('/test', (req, res) => res.json(req.body));
      // Test error handling
    });
  });
  ```

### 3. Performance

- Implement lazy loading for plugins to reduce startup time.
- Use caching in `StaticFilesPlugin` with `ETag` and `If-None-Match` headers.
- Leverage Node.js built-in modules (e.g., `stream`, `zlib`) for efficient data handling.
- Analyze bundle size with `@next/bundle-analyzer` and optimize with Rollup or esbuild.
- Use `node:worker_threads`, `node:child_process`, or `node:cluster` for CPU-intensive tasks if needed.

### 4. Security

- Add input validation in `BodyParserPlugin` to prevent injection attacks.
- Include Hapi-inspired security defaults (e.g., `helmet`-like headers) in `MiddlewarePlugin`.
- Implement rate limiting in `RateLimiterPlugin` to prevent abuse.

### 5. Maintainability

- Maintain a `CHANGELOG.md` in `docs/` to track releases and updates.
- Use semantic versioning in `package.json`.
- Write concise files (150-450 lines) with meaningful names and no duplication.

### 6. Community Engagement

- Provide a `CONTRIBUTING.md` with contribution guidelines.
- Respond to GitHub issues with clear, actionable feedback.
- Create a `TROUBLESHOOTING.md` in `docs/` for common issues.

## Coding Guidelines

### 1. Type Safety

- Use method overloads in `src/types/global.d.ts` for type inference.
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
- Strictly avoid `any` in public APIs. Use `unknown` with proper type guards if needed.

### 2. Plugin Architecture

- All features must reside in `src/plugins/`, inheriting from `BasePlugin`.

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
        // Use Map for route storage
      };
    }
  }
  ```

### 3. Testing

- Place tests in `examples/<feature>/<feature>.test.ts` for each feature.

  ```typescript
  // examples/routing/routing.test.ts
  import { createApp } from '../../src/index';

  describe('Routing', () => {
    it('handles GET requests', async () => {
      const app = createApp();
      app.get('/test', (req, res) => res.json({ message: 'OK' }));
      // Test logic
    });
  });
  ```

### 4. Performance Optimization

- Use Node.js built-in APIs (e.g., `stream`, `zlib`, `crypto`) for core functionality.
- Implement lazy loading and streaming in plugins.
  ```typescript
  app.get('/large-data', (req, res) => {
    const { pipeline } = require('node:stream');
    pipeline(createReadableStream(), res, (err) => {
      if (err) console.error('Stream error:', err);
    });
  });
  ```
- Use `Map` or `Set` for efficient data access instead of arrays or objects where applicable.
- Consider `node:worker_threads` for CPU-intensive tasks (e.g., parsing large JSON payloads).

### 5. Clean Code

- Use meaningful names and keep files concise (150-450 lines).
- Validate types with `npx tsc --noEmit`.
- Use JSDoc for all public APIs and internal complex logic.
  ```typescript
  /**
   * Parses request body as JSON.
   * @param req Incoming request
   * @param limit Maximum body size in bytes
   * @returns Parsed JSON object
   * @throws Error if JSON is malformed
   */
  async parseJsonBody(req: NextRushRequest, limit: number): Promise<unknown> {}
  ```

### 6. Refactoring and Migration

- **Temporary Files**: Use `t-<feature>.ts` for experimental implementations (e.g., `t-router.ts`). Merge into the original file (e.g., `router.plugin.ts`) and delete the temporary file. **Never create duplicate files** (e.g., `router-new.ts`).
- **Legacy Cleanup**: Migrate logic from `http/`, `middleware/`, and `routing/` to `src/plugins/`. Mark old files as deprecated by renaming to `x-deprecated-<filename>.ts` (e.g., `x-deprecated-ultimate-body-parser.ts`) and log changes in `docs/CHANGELOG.md`. Delete deprecated files after one release cycle.
- **Duplicate Detection**: Use `code-cleaner` to identify and remove duplicate files (e.g., `http/ultimate-body-parser.ts` and `plugins/body-parser/ultimate-body-parser.ts`). Delete redundant folders (`http/`, `routing/`, `middleware/`) after migration.

### 7. Script Writing

- Write shell scripts in `scripts/` instead of running terminal commands directly.
  ```bash
  # scripts/build.sh
  #!/bin/bash
  set -e
  npx tsc --build tsconfig.build.json
  npx prettier --write dist/
  exit 0
  ```
- Ensure scripts have timeouts or exit conditions to prevent hanging.
  ```bash
  # scripts/test.sh
  #!/bin/bash
  set -e
  timeout 300 npx jest --coverage
  exit 0
  ```

### 8. Documentation Updates

- Update `docs/<feature>.md` whenever a feature is created or modified.

  ````markdown
  <!-- docs/RouterPlugin.md -->

  # Router Plugin

  ## Usage

  ```typescript
  import { createApp } from 'next-rush';
  const app = createApp();
  app.get('/hello', (req, res) => res.json({ message: 'Hello, World!' }));
  ```
  ````

  ```

  ```

- Ensure 100% feature coverage in `docs/` with examples using `createApp` or `createRouter`.

### 9. Error Handling

- Implement robust error handling in all plugins and core logic.
  ```typescript
  app.get('/test', async (req, res) => {
    try {
      const data = await fetchData();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
      console.error('Error in /test:', err);
    }
  });
  ```
- Use custom error classes in `src/errors/` for specific scenarios.
  ```typescript
  // src/errors/validation-error.ts
  export class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  }
  ```

## Copilot Workflow Guidelines

### 1. Focus on Refinement

- Enhance existing files (e.g., `src/plugins/router/router.plugin.ts`) rather than creating new ones.
- Optimize code for performance, readability, and maintainability using smart DSA (e.g., `Map` for O(1) lookups).

### 2. Testing

- Add unit tests in `examples/<feature>/<feature>.test.ts` for all plugins and core features.
- Ensure edge cases (e.g., invalid routes, large payloads, timeouts) are covered.
- Use `timeout` in test scripts to prevent hanging.

### 3. Documentation

- Update `docs/<feature>.md` for every feature change or addition.
- Ensure documentation includes practical examples and npm import style.
- Link to OpenAPI specs if available.

### 4. Npm Readiness

- Verify `src/index.ts` exports align with `package.json` `"main"`.
- Test builds with `npm run build` and validate with `npm pack`.
- Include a `types` field in `package.json` for TypeScript support.

### 5. Community Support

- Add `CONTRIBUTING.md` and update `README.md` with contribution guidelines.
- Include a `TROUBLESHOOTING.md` for common issues and solutions.
- Respond to GitHub issues promptly with actionable feedback.

### 6. Bug Fixing and Debugging

- Identify issues from `CODEBASE-ANALYSIS-REPORT.md`, `PERFORMANCE-ANALYSIS.md`, or GitHub issues.
- Use structured logging via `PluginLogger` instead of `console.log`.
- Document fixes in `docs/CHANGELOG.md` with issue references.
- Search the web for solutions or ideas if needed, ensuring compatibility with Node.js built-in APIs.

### 7. Optimization

- Profile performance with `node --inspect` or `@next/bundle-analyzer`.
- Implement caching, lazy loading, and streaming where applicable.
- Use `node:worker_threads` or `node:cluster` for parallel processing if needed.
- Update `PERFORMANCE-ANALYSIS.md` with optimization results.

### 8. No Duplication

- Use `code-cleaner` to detect and remove duplicate files.
- Mark duplicates as `x-duplicate-<filename>.ts` before deletion and log in `CHANGELOG.md`.

### 9. Scripts with Timeouts

- Write all automation scripts in `scripts/` as `.sh` files with `timeout` or exit conditions.
  ```bash
  # scripts/analyze.sh
  #!/bin/bash
  set -e
  timeout 600 npx @next/bundle-analyzer
  exit 0
  ```

## Suggestions for Future Growth

### 1. Advanced Features

- Add decorator support (NestJS-inspired) for route and middleware definitions.
- Implement a `GraphQLPlugin` in `src/plugins/graphql/` with zero dependencies.
- Add support for HTTP/2 using `node:http2`.

### 2. Tooling

- Integrate a CLI tool (`next-rush-cli`) for scaffolding projects.
- Use Rollup or esbuild for better tree-shaking and bundle optimization.

### 3. Community

- Create a Discord or Slack channel for user support.
- Encourage plugin contributions with a `plugins/` registry on the website.

### 4. Monitoring

- Enhance `MetricsPlugin` with Prometheus integration for production monitoring.
- Include health checks (`/health`) in `Application`.

### 5. Documentation

- Develop an interactive tutorial on the project website.
- Provide API reference docs in OpenAPI format via `ApiDocsPlugin`.

## Example Prompts for Copilot

- **Testing**: "Create a test file `examples/body-parser/body-parser.test.ts` to test JSON and multipart parsing with edge cases."
- **Optimization**: "Optimize `src/plugins/static-files/static-files.plugin.ts` with ETag caching and streaming using `node:stream`."
- **Documentation**: "Update `docs/TemplateEngine.md` with a `createApp` example and npm import style."
- **Npm Prep**: "Verify `src/index.ts` exports and suggest updates for `package.json` scripts."
- **Bug Fix**: "Debug and fix a memory leak in `src/plugins/websocket/websocket.plugin.ts` using `node --inspect`."
- **Refactoring**: "Refactor `src/core/app/application.ts` into a `CoreApplicationPlugin` under `src/plugins/core/` using `t-core-application.ts` temporarily."
- **Advanced Feature**: "Design a `GraphQLPlugin` prototype in `src/plugins/graphql/` using `node:http`."

## Notes

- **No Legacy Reference**: Focus on the current codebase; old files are migrated or marked as deprecated.
- **Type Safety**: Enforce `NextRushRequest`, `NextRushResponse`, etc., with no `any`.
- **Testing**: Prioritize `examples/` for all test cases with 90%+ coverage.
- **Performance**: Use Node.js built-in APIs and smart DSA to address poor benchmark results.
- **Documentation**: Keep `docs/` aligned with npm usage and community needs.
- **Cleanup**: Strictly adhere to temporary file, duplicate detection, and legacy migration guidelines.
- **Error Handling**: Implement robust error handling to improve developer experience and prevent crashes.

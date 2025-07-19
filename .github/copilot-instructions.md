# GitHub Copilot Instructions for NextRush Project

## Project Overview

You are an expert in TypeScript, Node.js, and web framework development, tasked with advancing **NextRush**, a modular, type-safe, and developer-friendly web framework designed to surpass Express.js in simplicity, power, and maintainability. NextRush is a production-ready TypeScript-based alternative for building APIs, web applications, and real-time systems, now preparing for npm publication and community adoption. Key principles include:

- **Type Safety**: Utilize TypeScript with method overloads and type inference via `src/types/global.d.ts`, ensuring `NextRushRequest`, `NextRushResponse`, `RequestContext`, and `NextRush` types are inferred without manual imports. **Prohibit the use of `any` in user-facing APIs.**
- **Unified Plugin Architecture**: All features (routing, middleware, WebSocket, static files, templating) must be implemented as plugins under `src/plugins/`, inheriting from `BasePlugin`. No legacy `components` or separate structures are permitted.
- **Express-Like Developer Experience (DX)**: Maintain a familiar, intuitive API (`createApp`, `app.get`, `app.use`, `app.ws`, `app.static`, `app.render`) that abstracts complexity.
- **Zero Dependencies**: Leverage built-in Node.js features for core functionality (e.g., body parsing, WebSocket, templating) to minimize external libraries.
- **Enterprise-Grade Quality**: Adhere to standards inspired by Fastify (performance), Hapi (security), NestJS (architecture), and Koa (elegance).
- **Clean Code**: Prioritize maintainability, readability, and performance with concise files (150-450 lines), modular design, and zero duplication.

### Project Details

- **Purpose**: NextRush aims to provide a lightweight, type-safe framework for developers building RESTful APIs, web apps, and real-time applications, emphasizing extensibility via plugins.
- **Version**: Currently pre-1.0.0, targeting a stable 1.0.0 release post-npm testing.
- **Unique Features**: Enhanced request/response enhancers, a unified plugin system, event-driven architecture, and zero-dependency implementations.
- **Target Audience**: Node.js developers seeking a modern, type-safe alternative to Express.js with built-in advanced features.

## Current Project State

### File Structure

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
├── tsconfig.tsbuildinfo
```

### Completed Features

- Plugin-based architecture with `BasePlugin` and `PluginRegistry`.
- Core plugins: `RouterPlugin`, `MiddlewarePlugin`, `StaticFilesPlugin`, `WebSocketPlugin`, `TemplatePlugin`, `BodyParserPlugin`.
- Type-safe APIs with `NextRushRequest`, `NextRushResponse`, and `RequestContext`.
- Zero-dependency implementations for WebSocket, templating, and body parsing.
- Documentation in `docs/` covering all features.

### Next-Level Goals

- Prepare for npm publication with a stable API (`createApp`, `createRouter`).
- Implement comprehensive unit tests in `examples/` with 80%+ coverage.
- Optimize performance (e.g., bundle size, route matching).
- Enhance documentation for community use (e.g., website integration, OpenAPI specs).
- Support ongoing maintenance, contributions, and future enhancements (e.g., GraphQL, CLI).

## Best Practices

### 1. Code Quality

- Use JSDoc for all public APIs to improve readability and tooling support.
  ```typescript
  /**
   * Creates a new NextRush application instance.
   * @param options Configuration options
   * @returns Application instance
   */
  export function createApp(options?: ApplicationOptions): Application {}
  ```
- Enforce consistent formatting with `npx eslint` and `npx prettier` in CI pipelines.

### 2. Testing

- Achieve 80%+ code coverage with Jest or Vitest in `examples/`.
- Include edge cases (e.g., invalid routes, large file uploads).

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

### 3. Performance

- Implement lazy loading for plugins to reduce startup time.
- Use caching in `StaticFilesPlugin` with `ETag` and `If-None-Match` headers.
- Analyze bundle size with `@next/bundle-analyzer` (adapted for TypeScript).

### 4. Security

- Add input validation in `BodyParserPlugin` to prevent injection attacks.
- Include Hapi-inspired security defaults (e.g., `helmet`-like headers) in `MiddlewarePlugin`.

### 5. Maintainability

- Maintain a `CHANGELOG.md` in `docs/` to track releases and updates.
- Use semantic versioning in `package.json`.

### 6. Community Engagement

- Provide a `CONTRIBUTING.md` with contribution guidelines.
- Respond to GitHub issues with clear, actionable feedback.

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
- Strictly avoid `any` in public APIs.

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
        // Routing logic
      };
    }
  }
  ```

### 3. Testing

- Place tests in `examples/<feature>/<feature>.test.ts`.

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

### 4. Performance Optimization

- Use lazy loading and streaming in plugins.
  ```typescript
  app.get('/large-data', (req, res) => {
    const stream = createReadableStream();
    stream.pipe(res);
  });
  ```

### 5. Clean Code

- Use meaningful names and keep files concise (150-450 lines).
- Validate types with `npx tsc --noEmit`.

### 6. Refactoring and Migration

- **Temporary Files**: For experimental or temporary implementations, use `t-<feature>.ts` (e.g., `t-router.ts`). Once finalized, merge into the original file (e.g., `router.plugin.ts`) and delete the temporary file. **Restriction**: Do not create duplicate files or folders. If a feature exists (e.g., in `router.plugin.ts`), update it instead of creating a new file (e.g., `router-new.ts`). Check the old codebase and `docs/` first.
- **Legacy Cleanup**: Migrate remaining logic from `http/`, `middleware/`, and `routing/` to `src/plugins/`. After migration, mark old files as deprecated by renaming them to `x-deprecated-<filename>.ts` (e.g., `x-deprecated-ultimate-body-parser.ts`) and log changes in `docs/CHANGELOG.md`. Use tools like `code-cleaner` to identify and remove duplicate files (e.g., `http/ultimate-body-parser.ts` and `plugins/body-parser/ultimate-body-parser.ts`). Delete redundant folders (`http/`, `routing/`, `middleware/`) after migration.
- **Deprecation Process**: When replacing old code, rename the original file to `x-deprecated-<filename>.ts` and update references to the new implementation. Do not delete deprecated files immediately; retain them for one release cycle before removal, documented in `CHANGELOG.md`.

## Copilot Workflow Guidelines

### 1. Focus on Refinement

- Enhance existing files (e.g., `src/plugins/router/router.plugin.ts`) rather than creating new ones.
- Optimize code for performance, readability, and maintainability.

### 2. Testing

- Add unit tests in `examples/` for all plugins and core features using Jest or Vitest with TypeScript support.
- Ensure edge cases (e.g., invalid routes, large payloads) are covered.

### 3. Documentation

- Update `docs/` with new examples using `createApp` and `createRouter`.
- Ensure 100% feature coverage and link to a website or OpenAPI specs if available.

### 4. Npm Readiness

- Verify `src/index.ts` exports align with `package.json` `"main"`.
- Test builds with `npm run build` and validate with `npm pack`.

### 5. Community Support

- Add `CONTRIBUTING.md` and update `README.md` with contribution guidelines.
- Include a section for reporting bugs and requesting features.

### 6. Bug Fixing and Debugging

- Identify and resolve issues reported in `CODEBASE-ANALYSIS-REPORT.md` or GitHub issues.
- Use `console.log` or a debugger sparingly; prefer structured logging via `PluginLogger`.
- Document fixes in `CHANGELOG.md` with issue references.

### 7. Optimization

- Profile performance with `node --inspect` or `@next/bundle-analyzer`.
- Implement caching, lazy loading, and streaming where applicable.
- Update `PERFORMANCE-ANALYSIS.md` with optimization results.

### 8. No Duplication

- Consolidate logic into existing files; avoid redundant implementations.
- Use `code-cleaner` to detect duplicates and refactor accordingly.

## Suggestions for Future Growth

### 1. Advanced Features

- Add decorator support (NestJS-inspired) for route and middleware definitions.
- Implement a `GraphQLPlugin` in `src/plugins/graphql/` with zero dependencies.

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

- **Testing**: "Create a test file `examples/body-parser/body-parser.test.ts` to test JSON and multipart parsing."
- **Optimization**: "Optimize `src/plugins/static-files/static-files.plugin.ts` with ETag caching."
- **Documentation**: "Update `docs/TemplateEngine.md` with a `createApp` example and npm import style."
- **Npm Prep**: "Verify `src/index.ts` exports and suggest updates for `package.json` scripts."
- **Bug Fix**: "Debug and fix a potential memory leak in `src/plugins/websocket/websocket.plugin.ts`."
- **Refactoring**: "Refactor `src/core/app/application.ts` into a `CoreApplicationPlugin` under `src/plugins/core/` using `t-core-application.ts` temporarily."
- **Advanced Feature**: "Design a `GraphQLPlugin` prototype in `src/plugins/graphql/`."

## Notes

- **No Legacy Reference**: Focus on the current codebase; old files are migrated or marked as deprecated.
- **Type Safety**: Enforce `NextRushRequest`, `NextRushResponse`, etc., with no `any`.
- **Testing**: Prioritize `examples/` for all test cases with 80%+ coverage.
- **Performance**: Use tools like `@next/bundle-analyzer` for optimization.
- **Documentation**: Keep `docs/` aligned with npm usage and community needs.
- **Cleanup**: Adhere to temporary file and legacy migration guidelines strictly.

---

### Analysis and Improvements

#### What Was Checked

- **Refactoring Mention**: The original instructions mention refactoring implicitly (e.g., "move remaining logic from `http/`, `middleware/`, and `routing/` to `plugins/`"), but it lacks explicit guidance on temporary files and legacy cleanup. The revised version adds these details.
- **Temporary Files and Cleanup**: The original lacks specific instructions for `t-<feature>.ts`, deprecated file naming (`x-deprecated-<filename>.ts`), and folder removal. These are now included with clear processes.
- **Refactoring, Optimization, Bug Fix, Debug**: The original covers some aspects (e.g., optimization with `@next/bundle-analyzer`), but the revised version explicitly addresses bug fixing, debugging, and a structured refactoring workflow.
- **Robustness**: The original is solid but misses professional touches (e.g., deprecation cycles, CI enforcement). The revised version enhances these with actionable steps.

#### Is the Original Instruction Best for Refactoring and Optimization?

- **Pros**: It provides a good foundation with type safety, plugin architecture, and performance goals.
- **Cons**: It lacks detailed refactoring workflows, legacy cleanup, and bug-fixing guidelines. The absence of temporary file management and deprecation processes could lead to code duplication or incomplete migrations.
- **Verdict**: The original is a strong starting point but needs enhancement for a professional, robust refactoring and optimization process.

#### Improvements Made

1. **Refactoring Workflow**: Added explicit steps for using `t-<feature>.ts`, merging into original files, and deleting temporaries.
2. **Legacy Cleanup**: Introduced `x-deprecated-<filename>.ts` naming, a one-release-cycle retention policy, and folder removal after migration.
3. **Bug Fixing and Debugging**: Included guidelines for structured logging, issue tracking, and documentation.
4. **Optimization**: Expanded with profiling tools and performance documentation updates.
5. **Professional Tone**: Used formal language, detailed sections, and actionable checklists.
6. **Completeness**: Covered all aspects (testing, documentation, npm readiness) with enhanced clarity.

#### Final Assessment

The revised `.md` file is now more perfect and robust, suitable for refactoring, optimization, bug fixing, debugging, and community adoption. It provides a clear, professional roadmap for advancing NextRush to a 1.0.0 release while ensuring maintainability and scalability. Implement this updated instruction set in your GitHub repository to guide Copilot and your development team effectively.

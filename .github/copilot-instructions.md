# GitHub Copilot Instructions for NextRush Project

## ⚠️ **PROJECT STATUS: LEARNING PROJECT COMPLETED**

**IMPORTANT**: This project (NextRush v1.0) is now **COMPLETED** as a learning project and is in **archival status**.

### **🎓 Project Completion Status:**

- ✅ **Educational objectives achieved**
- ✅ **Learning documentation completed** (LESSONS-LEARNED.md, PROJECT-STATUS.md)
- ✅ **Performance benchmarking completed**
- ✅ **Architecture lessons documented**
- ✅ **Ready for archival and NextRush v2.0 planning**

### **🚨 No Further Development:**

- This codebase is preserved for educational reference
- No new features or optimizations should be implemented
- Focus should be on documentation and archival tasks only
- Any development work should target NextRush v2.0 (new repository)

### **📚 Educational Context:**

This was my **first attempt** at building a web framework and publishing an NPM package. The primary goal was learning, not production readiness.

---

## Original Project Overview (Archived)

You are an expert in TypeScript, Node.js, and web framework development, tasked with advancing **NextRush**, a modular, type-safe, and developer-friendly web framework designed to surpass Express.js in simplicity, power, and maintainability. NextRush is a production-ready TypeScript-based alternative for building APIs, web applications, and real-time systems, preparing for npm publication and community adoption. Key principles include:

- **Type Safety**: Utilize TypeScript with method overloads, generics, and type inference via `src/types/global.d.ts`, ensuring `NextRushRequest`, `NextRushResponse`, `RequestContext`, and `NextRush` types are inferred without manual imports. **Prohibit the use of `any` in user-facing APIs.**
- **Unified Plugin Architecture**: All features (routing, middleware, WebSocket, static files, templating) must be implemented as plugins under `src/plugins/`, adhering to the Open/Closed Principle (OCP) using abstract classes and interfaces, inheriting from `BasePlugin`. No legacy `components` or separate structures are permitted.
- **Express-Like Developer Experience (DX)**: Maintain a familiar, intuitive API (`createApp`, `app.get`, `app.use`, `app.ws`, `app.static`, `app.render`) that abstracts complexity.
- **Zero Dependencies**: Leverage built-in Node.js APIs (e.g., `http`, `url`, `stream`, `zlib`, `crypto`, `fs`, `buffer`) for core functionality to minimize external libraries.
- **Enterprise-Grade Quality**: Adhere to standards inspired by Fastify (performance), Hapi (security), NestJS (architecture), and Koa (elegance).
- **Clean Code**: Prioritize maintainability, readability, and performance with concise files (150-450 lines), modular design, zero duplication, and optimized algorithms.
- **High Performance**: Optimize for millisecond-level performance using OS-level insights, efficient data structures, zero-copy transfers, and low-level Node.js APIs.
- **Modularity and Loose Coupling**: Enforce Single Responsibility Principle (SRP), separation of concerns, and Inversion of Control (IoC) to avoid tight coupling.

### Project Details

- **Purpose**: NextRush aims to provide a lightweight, type-safe framework for developers building RESTful APIs, web apps, and real-time systems, emphasizing extensibility via plugins.
- **Version**: Pre-1.0.0, targeting a stable 1.0.0 release post-npm testing.
- **Unique Features**: Enhanced request/response enhancers, unified plugin system, event-driven architecture, zero-dependency implementations, plugin sandbox mode, and dynamic plugin loading.
- **Target Audience**: Node.js developers seeking a modern, type-safe alternative to Express.js with built-in advanced features.
- **Critical Issues**: Poor benchmark results and bad developer experience due to unoptimized code, memory leaks, unbounded concurrency, and duplicate files. Copilot must focus on fixing these with high-performance solutions.

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
│   │   ├── plugin-loader.ts  # Dynamic plugin loading
│   │   ├── event-system.ts
│   │   └── index.ts
│   ├── errors/           # Error handling
│   ├── helpers/          # Utility functions
│   ├── plugins/          # All features as plugins
│   │   ├── api-docs/
│   │   ├── auth/
│   │   ├── body-parser/
│   │   ├── core/        # Plugin base classes and abstract classes
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
│   │   ├── worker-pool.ts  # Worker thread management
│   │   ├── fd-pool.ts     # File descriptor pooling
│   │   └── buffer-pool.ts # Buffer pooling
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

- Address critical performance issues identified in `PERFORMANCE-ANALYSIS.md` and `benchmark-results.json` with millisecond-level optimizations.
- Prepare for npm publication with a stable API (`createApp`, `createRouter`).
- Implement comprehensive unit tests in `examples/` with 90%+ coverage.
- Optimize bundle size, route matching, and startup time using OS-level insights, zero-copy transfers, and efficient algorithms.
- Enhance documentation for community use (e.g., website integration, OpenAPI specs).
- Support ongoing maintenance, contributions, and future enhancements (e.g., GraphQL, CLI).

## Critical Issues to Address

- **Poor Benchmark Results**: Optimize for high performance with efficient route matching, lazy loading, streaming, zero-copy transfers, and low-level Node.js APIs.
- **Bad Developer Experience**: Simplify APIs, improve error messages, ensure consistent type inference, and eliminate duplicate files and legacy code.
- **Memory Leaks**: Ban global/module caches without cleanup hooks and profile memory usage to prevent leaks.
- **Unbounded Concurrency**: Use semaphores to control parallel tasks and prevent resource exhaustion.

## Best Practices

### 1. Code Quality

- Use JSDoc for all public APIs and complex internal logic to improve readability and tooling support.
  ```typescript
  /**
   * Creates a new NextRush application instance.
   * @param options Configuration options for the application
   * @returns Application instance
   */
  export function createApp<T extends ApplicationOptions>(
    options?: T
  ): Application<T> {}
  ```
- Enforce consistent formatting with `npx eslint` and `npx prettier` in CI pipelines.
- Use smart data structures (e.g., `Map` for O(1) route lookups, `Set` for unique middleware) and algorithms (e.g., trie for route matching).
- Enforce maximum file size (~450 LOC, with rare exceptions) via CI linter/checks.

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

- Support plugin sandbox mode for isolated testing outside the app.

  ```typescript
  // examples/plugin-sandbox.ts
  import { RouterPlugin } from '../../src/plugins/router';

  describe('Router Plugin Sandbox', () => {
    it('tests router in isolation', () => {
      const plugin = new RouterPlugin();
      const mockApp = { get: jest.fn() };
      plugin.install(mockApp);
      // Test logic
    });
  });
  ```

### 3. Performance

- Configure HTTP keep-alive timeouts to reduce TCP handshake overhead.
  ```typescript
  // src/core/app/application.ts
  import { createServer } from 'node:http';
  const server = createServer(app.callback()).setTimeout(10000); // 10s keep-alive
  ```
- Use `sendfile` (via `node:fs`) for zero-copy static file transfers in `StaticFilesPlugin`.
  ```typescript
  // src/plugins/static-files/static-files.plugin.ts
  import { createReadStream } from 'node:fs';
  app.get('/file', (req, res) => {
    res.sendFile('/path/to/file', { zeroCopy: true });
  });
  ```
- Implement buffer pooling in `src/utils/buffer-pool.ts` for high-frequency I/O operations to reduce GC pressure.
  ```typescript
  // src/utils/buffer-pool.ts
  class BufferPool {
    private pool: Buffer[] = [];
    acquire(size: number): Buffer {
      return this.pool.pop() ?? Buffer.allocUnsafe(size).fill(0);
    }
    release(buffer: Buffer): void {
      this.pool.push(buffer);
    }
  }
  ```
- Implement back-pressure handling in streams to prevent memory overload.
  ```typescript
  app.get('/stream', (req, res) => {
    const { pipeline } = require('node:stream');
    const source = createReadableStream();
    pipeline(source, res, (err) => {
      if (err) console.error('Stream error:', err);
    });
    source.on('data', () => {
      if (!res.writable) source.pause(); // Back-pressure
    });
  });
  ```
- Analyze bundle size with `@next/bundle-analyzer` and optimize with Rollup or esbuild.
- Use `node:worker_threads`, `node:child_process`, or `node:cluster` for CPU-intensive tasks, ensuring proper synchronization and cleanup.

### 4. Security

- Add input validation in `BodyParserPlugin` to prevent injection attacks.
- Include Hapi-inspired security defaults (e.g., `helmet`-like headers) in `MiddlewarePlugin`.
- Implement rate limiting in `RateLimiterPlugin` to prevent abuse.

### 5. Maintainability

- Maintain a `CHANGELOG.md` in `docs/` to track releases and updates.
- Use semantic versioning in `package.json`.
- Write concise files (150-450 lines, enforced via CI) with meaningful names and no duplication.
- Prefer modular design over monolithic files, using abstract classes and interfaces.

### 6. Community Engagement

- Provide a `CONTRIBUTING.md` with contribution guidelines.
- Respond to GitHub issues with clear, actionable feedback.
- Create a `TROUBLESHOOTING.md` in `docs/` for common issues.

## Coding Guidelines

### 1. Type Safety and TypeScript Features

- Use method overloads, generics, and conditional types in `src/types/global.d.ts` for type inference.
  ```typescript
  declare module 'next-rush' {
    interface NextRush {
      get<T extends RequestContext>(
        path: string,
        handler: (req: NextRushRequest<T>, res: NextRushResponse<T>) => void
      ): this;
      use<T extends RequestContext>(
        middleware: (
          req: NextRushRequest<T>,
          res: NextRushResponse<T>,
          next: () => void
        ) => void
      ): this;
    }
  }
  ```
- Strictly avoid `any` in public APIs. Use `unknown` with type guards or generics for flexibility.
- Leverage TypeScript's advanced features (e.g., `satisfies`, mapped types, template literal types).
  ```typescript
  type RoutePath = `/${string}`;
  function registerRoute<T extends RoutePath>(path: T): void {}
  ```

### 2. Open/Closed Principle (OCP)

- Design plugins to be open for extension but closed for modification, using abstract classes and interfaces.
  ```typescript
  // src/plugins/core/base-plugin.ts
  abstract class BasePlugin {
    abstract name: string;
    abstract install(app: Application): void;
    protected onInit?(): void;
    protected onRequest?(req: NextRushRequest, res: NextRushResponse): void;
    protected onError?(
      err: Error,
      req: NextRushRequest,
      res: NextRushResponse
    ): void;
    protected onCleanup?(): void; // Cleanup hook for caches
    protected log(message: string): void {
      console.log(`[${this.name}] ${message}`);
    }
  }
  ```
- Plugins must use lifecycle hooks (e.g., `onInit`, `onRequest`, `onError`, `onCleanup`) to interact with the app, avoiding direct modification of app internals.

### 3. Inversion of Control (IoC) via Composition

- The `Application` object orchestrates plugin lifecycle, not vice versa.
- Use Dependency Injection (DI) via constructors or setup methods.
  ```typescript
  // src/plugins/body-parser/body-parser.plugin.ts
  class BodyParserPlugin extends BasePlugin {
    constructor(private config: { maxPayloadSize: number }) {
      super();
    }
    name = 'BodyParser';
    install(app: Application) {
      app.use(async (req, res, next) => {
        // Use config.maxPayloadSize
        next();
      });
    }
  }
  ```
- Plugins must request capabilities (e.g., logging, metrics) via the app or context, avoiding hard dependencies on other plugins.

### 4. Plugin Isolation and Sandbox Mode

- No plugin should directly modify app internals; use hooks or events instead.
- Support plugin sandbox mode for isolated testing.
  ```typescript
  // src/plugins/core/plugin-sandbox.ts
  class PluginSandbox {
    constructor(private plugin: BasePlugin) {}
    test(appMock: Partial<Application>) {
      this.plugin.install(appMock as Application);
    }
  }
  ```

### 5. Error Boundaries

- Wrap every async handler in try-catch to prevent crashes, integrated with `onError` hooks.
  ```typescript
  app.get('/test', async (req, res) => {
    try {
      const data = await fetchData();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
      this.onError?.(err, req, res);
    }
  });
  ```
- Use custom error classes in `src/errors/`.
  ```typescript
  // src/errors/validation-error.ts
  export class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  }
  ```

### 6. Single Responsibility Principle (SRP) and Separation of Concerns

- Each plugin or module must have a single responsibility (e.g., routing, body parsing).
- Avoid tight coupling by using interfaces, DI, and event-driven communication.
  ```typescript
  // src/plugins/core/plugin-contract.ts
  interface PluginContract {
    initialize(app: Application): void;
    cleanup(): void;
  }
  ```

### 7. Memory Management

- Ban global/module caches without cleanup hooks in `onCleanup`.
  ```typescript
  // src/plugins/static-files/static-files.plugin.ts
  class StaticFilesPlugin extends BasePlugin {
    private cache = new Map<string, Buffer>();
    onCleanup() {
      this.cache.clear();
    }
  }
  ```
- Use `Buffer.allocUnsafe` with explicit zeroing for performance-critical paths, with bounds checking.
  ```typescript
  const buffer = Buffer.allocUnsafe(size).fill(0);
  ```
- Implement memory usage monitoring in `MetricsPlugin` using `process.memoryUsage()`.
  ```typescript
  // src/plugins/metrics/metrics.plugin.ts
  app.get('/metrics', (req, res) => {
    const memory = process.memoryUsage();
    res.json({ heapUsed: memory.heapUsed, heapTotal: memory.heapTotal });
  });
  ```
- Use `WeakMap` or `WeakSet` for transient caches to allow garbage collection.
- Profile memory leaks with `node --inspect`, `heapdump`, or `clinic.js` in CI.

### 8. Unbounded Concurrency

- Use a semaphore to control parallel tasks and prevent resource exhaustion.
  ```typescript
  // src/utils/semaphore.ts
  class Semaphore {
    private count: number;
    constructor(max: number) {
      this.count = max;
    }
    async acquire(): Promise<void> {
      while (this.count <= 0)
        await new Promise((resolve) => setTimeout(resolve, 10));
      this.count--;
    }
    release(): void {
      this.count++;
    }
  }
  ```

### 9. Thread and Process Management

- Use `node:worker_threads` and `node:cluster` with explicit synchronization and cleanup.

  ```typescript
  // src/utils/worker-pool.ts
  import { Worker } from 'node:worker_threads';

  class WorkerPool {
    private pool: Worker[] = [];
    async run(task: Buffer): Promise<unknown> {
      const worker = this.pool.pop() ?? new Worker('./worker.js');
      return new Promise((resolve, reject) => {
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', () => worker.terminate());
        worker.postMessage(task);
      });
    }
    cleanup() {
      this.pool.forEach((worker) => worker.terminate());
    }
  }
  ```

- Use `SharedArrayBuffer` for inter-thread communication in CPU-intensive tasks (e.g., cryptographic operations in `AuthPlugin`).
  ```typescript
  const sab = new SharedArrayBuffer(1024);
  const worker = new Worker('./crypto-worker.js', { workerData: sab });
  ```
- Ensure proper termination of workers and child processes to avoid zombie processes.

### 10. File System Optimization

- Use `fs.promises.open` with `O_DIRECT` or `O_NONBLOCK` for high-performance file reads in `StaticFilesPlugin`.
  ```typescript
  // src/plugins/static-files/static-files.plugin.ts
  import { promises as fs } from 'node:fs';
  async function serveFile(
    req: NextRushRequest,
    res: NextRushResponse,
    path: string
  ) {
    const fd = await fs.open(path, 'r', 0o666 | constants.O_DIRECT);
    // Serve file
    await fd.close();
  }
  ```
- Implement file descriptor pooling in `src/utils/fd-pool.ts`.
  ```typescript
  // src/utils/fd-pool.ts
  class FileDescriptorPool {
    private pool: Map<string, number> = new Map();
    async acquire(path: string): Promise<number> {
      return this.pool.get(path) ?? (await fs.open(path, 'r')).fd;
    }
    release(path: string): void {
      // Optional cleanup
    }
  }
  ```
- Cache `fs.stat` results with a TTL-based cache to reduce disk I/O.
  ```typescript
  // src/utils/stat-cache.ts
  class StatCache {
    private cache = new Map<string, { stat: fs.Stats; ttl: number }>();
    async get(path: string): Promise<fs.Stats> {
      const entry = this.cache.get(path);
      if (entry && entry.ttl > Date.now()) return entry.stat;
      const stat = await fs.stat(path);
      this.cache.set(path, { stat, ttl: Date.now() + 60000 });
      return stat;
    }
  }
  ```

### 11. Dynamic Plugin Loading

- Implement a `PluginLoader` in `src/core/plugin-loader.ts` for runtime plugin loading from a directory or npm package.

  ```typescript
  // src/core/plugin-loader.ts
  import { BasePlugin } from '../plugins/core/base-plugin';

  class PluginLoader {
    async loadPlugin(path: string): Promise<BasePlugin> {
      const module = await import(path);
      return new module.default();
    }
    register(app: Application, plugin: BasePlugin) {
      plugin.install(app);
    }
  }
  ```

### 12. Cross-Platform Compatibility

- Ensure cross-platform compatibility by using Node.js built-in APIs and avoiding platform-specific syscalls.
- Test on Linux, Windows, and macOS in CI pipelines.
- Use `node:path` for path handling to ensure portability.
  ```typescript
  import { join } from 'node:path';
  const filePath = join('public', 'file.txt');
  ```

### 13. Testing

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

### 14. Performance Optimization

- Use efficient data structures (`Map` for O(1) lookups, `Set` for unique entries) and algorithms (e.g., trie for route matching).
- Leverage `node:worker_threads` for CPU-intensive tasks with proper cleanup.
- Use `node:cluster` for multi-core scaling in production, ensuring proper process management.

### 15. Clean Code

- Use meaningful names and keep files concise (150-450 lines, enforced via CI).
- Validate types with `npx tsc --noEmit`.
- Use JSDoc for all public APIs and internal complex logic.
  ```typescript
  /**
   * Parses request body as JSON.
   * @param req Incoming request
   * @param limit Maximum body size in bytes
   * @returns Parsed JSON object
   * @throws ValidationError if JSON is malformed
   */
  async parseJsonBody(req: NextRushRequest, limit: number): Promise<unknown> {}
  ```

### 16. Refactoring and Migration

- **Temporary Files**: Use `t-<feature>.ts` for experimental implementations (e.g., `t-router.ts`). Merge into the original file (e.g., `router.plugin.ts`) and delete the temporary file. **Never create duplicate files** (e.g., `router-new.ts`).
- **Legacy Cleanup**: Migrate logic from `http/`, `middleware/`, and `routing/` to `src/plugins/`. Mark old files as deprecated by renaming to `x-deprecated-<filename>.ts` (e.g., `x-deprecated-ultimate-body-parser.ts`) and log changes in `docs/CHANGELOG.md`. Delete deprecated files after one release cycle.
- **Duplicate Detection**: Use `code-cleaner` to identify and remove duplicate files. Mark duplicates as `x-duplicate-<filename>.ts` before deletion and log in `CHANGELOG.md`.

### 17. Script Writing

- Write shell scripts in `scripts/` as `.sh` files with timeouts or exit conditions.
  ```bash
  # scripts/build.sh
  #!/bin/bash
  set -e
  timeout 300 npx tsc --build tsconfig.build.json
  npx prettier --write dist/
  exit 0
  ```

### 18. Documentation Updates

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

## Copilot Workflow Guidelines

### 1. Focus on Refinement

- Enhance existing files (e.g., `src/plugins/router/router.plugin.ts`) using abstract classes, interfaces, and lifecycle hooks to reduce duplication and ensure OCP compliance.
- Optimize code for performance (millisecond-level), readability, and maintainability using smart DSA.

### 2. Testing

- Add unit tests in `examples/<feature>/<feature>.test.ts` for all plugins and core features.
- Ensure edge cases (e.g., invalid routes, large payloads, timeouts) are covered.
- Use `timeout` in test scripts to prevent hanging.
- Support plugin sandbox mode for isolated testing.

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
- Search the web for solutions or ideas, ensuring compatibility with Node.js built-in APIs.

### 7. Optimization

- Profile performance with `node --inspect`, `heapdump`, or `clinic.js`.
- Implement caching, lazy loading, streaming, zero-copy transfers, and buffer pooling.
- Use `node:worker_threads` or `node:cluster` for parallel processing, with proper resource management.
- Update `PERFORMANCE-ANALYSIS.md` with optimization results.
- Optimize route matching with trie-based algorithms for O(1) performance.

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
  ```typescript
  @Route('GET', '/hello')
  class HelloController {
    handle(req: NextRushRequest, res: NextRushResponse) {
      res.json({ message: 'Hello, World!' });
    }
  }
  ```
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

- **Testing**: "Create a test file `examples/body-parser/body-parser.test.ts` to test JSON and multipart parsing with edge cases in sandbox mode."
- **Optimization**: "Optimize `src/plugins/static-files/static-files.plugin.ts` with `sendfile` for zero-copy transfers and buffer pooling."
- **Documentation**: "Update `docs/TemplateEngine.md` with a `createApp` example and npm import style."
- **Npm Prep**: "Verify `src/index.ts` exports and suggest updates for `package.json` scripts."
- **Bug Fix**: "Debug and fix a memory leak in `src/plugins/websocket/websocket.plugin.ts` using `node --inspect` and `heapdump`."
- **Refactoring**: "Refactor `src/core/app/application.ts` into a `CoreApplicationPlugin` under `src/plugins/core/` using `t-core-application.ts` temporarily, ensuring OCP compliance."
- **Advanced Feature**: "Design a `GraphQLPlugin` prototype in `src/plugins/graphql/` using `node:http` and DI."

## ⚠️ **ARCHIVED PROJECT NOTES**

**This project is now ARCHIVED for educational purposes. All development should focus on documentation and learning resources only.**

### **📚 Educational Focus Areas:**

- **Documentation Review**: Ensure all learning materials are comprehensive
- **Archive Preparation**: Help with project closure and archival tasks
- **Learning Resource Creation**: Assist with LESSONS-LEARNED.md and similar documents
- **No Feature Development**: Do not implement new features or optimizations

### **🎓 Learning Value Preservation:**

- **Architecture Lessons**: Document design decisions and their consequences
- **Performance Insights**: Preserve benchmarking results and analysis
- **Development Process**: Capture workflow lessons and process improvements
- **Technical Patterns**: Document TypeScript patterns and Node.js techniques used

### **📝 Archival Tasks Only:**

- Update documentation for educational clarity
- Create comprehensive learning guides
- Prepare project for educational reference
- Assist with final project closure tasks

---

## Original Project Notes (Archived)

- **No Legacy Reference**: Focus on the current codebase; old files are migrated or marked as deprecated.
- **Type Safety**: Enforce `NextRushRequest`, `NextRushResponse`, etc., with no `any`. Use advanced TypeScript features (generics, conditional types).
- **Testing**: Prioritize `examples/` for all test cases with 90%+ coverage, including sandbox mode.
- **Performance**: Use Node.js built-in APIs, smart DSA (e.g., trie for routing), zero-copy transfers, buffer pooling, and low-level optimizations for millisecond-level performance.
- **Documentation**: Keep `docs/` aligned with npm usage and community needs.
- **Cleanup**: Strictly adhere to temporary file, duplicate detection, and legacy migration guidelines.
- **Error Handling**: Implement robust error boundaries to improve developer experience and prevent crashes.
- **OOP Principles**: Use abstract classes, interfaces, IoC, and DI to enforce modularity, OCP, SRP, and loose coupling.
- **Cross-Platform Compatibility**: Ensure portability using `node:path` and cross-platform testing in CI.

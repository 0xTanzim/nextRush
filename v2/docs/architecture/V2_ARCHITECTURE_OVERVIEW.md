# NextRush v2 Architecture Overview 🏗️

## Table of Contents

1. [Architecture Principles](#architecture-principles)
2. [Core System Design](#core-system-design)
3. [Orchestration Layer](#orchestration-layer)
4. [Dependency Injection](#dependency-injection)
5. [Context System](#context-system)
6. [Middleware Architecture](#middleware-architecture)
7. [Plugin System](#plugin-system)
8. [Performance Design](#performance-design)

---

## Architecture Principles

### 1. **Zero Runtime Dependencies** 🎯

- Complete elimination of external runtime dependencies
- Custom implementations for all core functionality
- Reduced bundle size and security surface area

### 2. **Type-First Design** 📝

- Comprehensive TypeScript coverage
- Context-aware type inference
- Plugin type safety and validation

### 3. **Performance-Oriented Architecture** ⚡

- Sub-millisecond response times
- Memory-efficient data structures
- Optimized routing algorithms

### 4. **Orchestration Layer** 🎭

- Centralized coordination of framework components
- Clean separation of concerns
- Testable and maintainable architecture

---

## Core System Design

```
NextRush v2 Application
├── Application Layer
│   ├── Application.ts (Main entry point)
│   └── Context.ts (Request/Response context)
├── Orchestration Layer
│   ├── ApplicationOrchestrator.ts (Central coordinator)
│   ├── RouteRegistry.ts (Route management)
│   ├── MiddlewareChain.ts (Middleware execution)
│   └── ServerManager.ts (HTTP server management)
├── Core Middleware (Built-in)
│   ├── CORS, Helmet, Compression
│   ├── Body Parser, Logger, Timer
│   └── Rate Limiter, Request ID
├── Plugin System (Advanced Features)
│   └── Logger Plugin (Enhanced logging)
└── Custom DI Container
    └── Zero-dependency injection system
```

---

## Orchestration Layer

The orchestration layer is the architectural heart of NextRush v2, providing centralized coordination and management of all framework components.

### ApplicationOrchestrator

- **Purpose**: Central coordination hub for all framework operations
- **Responsibilities**:
  - Component lifecycle management
  - Cross-cutting concerns coordination
  - Performance optimization orchestration

### RouteRegistry

- **Purpose**: Efficient route storage and retrieval
- **Features**:
  - O(1) route lookup performance
  - Parameter extraction optimization
  - Route pattern matching with caching

### MiddlewareChain

- **Purpose**: Optimized middleware execution pipeline
- **Features**:
  - Koa-style async middleware support
  - Error boundary management
  - Performance monitoring integration

### ServerManager

- **Purpose**: HTTP server lifecycle management
- **Features**:
  - Graceful server startup/shutdown
  - Port and host configuration handling
  - Connection management optimization

---

## Dependency Injection

NextRush v2 implements a custom, zero-dependency DI container system:

### Key Features:

- **Zero Runtime Dependencies**: No external DI libraries
- **Type Safety**: Full TypeScript integration
- **Performance**: Optimized for high-performance scenarios
- **Flexibility**: Support for singletons, transients, and factories

### Usage Example:

```typescript
import { DIContainer } from '@/core/di/container';

const container = new DIContainer();

// Register services
container.register('userService', UserService);
container.registerSingleton('logger', Logger);

// Resolve dependencies
const userService = container.resolve<UserService>('userService');
```

---

## Context System

The context system provides the foundation for request/response handling:

### Context Architecture:

```typescript
interface Context {
  // HTTP Primitives
  req: IncomingMessage;
  res: ServerResponse;

  // Enhanced Properties
  method: string;
  path: string;
  query: Record<string, any>;
  params: Record<string, string>;
  headers: Record<string, string>;
  body: any;

  // Response Helpers
  json(data: any): void;
  text(data: string): void;
  status(code: number): this;

  // Plugin Extensions
  logger?: Logger;
  [key: string]: any;
}
```

### Key Features:

- **Koa-Style Context**: Unified request/response object
- **Express-Like API**: Familiar response methods
- **Type Safety**: Full TypeScript inference
- **Extensibility**: Plugin-based property injection

---

## Middleware Architecture

NextRush v2 provides a comprehensive built-in middleware system:

### Built-in Middleware:

#### Security & Headers

- **CORS**: Cross-origin resource sharing with full configurability
- **Helmet**: Security headers with performance optimization
- **Request ID**: Unique request identification for tracing

#### Body Processing

- **Enhanced Body Parser**:
  - Multi-format support (JSON, Form, Multipart)
  - Streaming capabilities for large payloads
  - Memory optimization with buffer pools
  - Timeout handling and error recovery

#### Performance & Monitoring

- **Compression**: Gzip/deflate with intelligent content-type detection
- **Timer**: Request timing with sub-millisecond precision
- **Rate Limiter**: Token bucket algorithm with memory stores
- **Logger**: Structured logging with performance considerations

### Middleware Pattern:

```typescript
type Middleware = (ctx: Context, next: Next) => Promise<void>;

// Usage
app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await next();
});
```

---

## Plugin System

The plugin system extends framework functionality for advanced use cases:

### Plugin Architecture:

```typescript
abstract class BasePlugin {
  abstract name: string;
  abstract install(app: Application): void;

  // Lifecycle hooks
  protected onInstall?(): void;
  protected onUninstall?(): void;
}
```

### Available Plugins:

#### Logger Plugin

- **Advanced Logging**: Multiple transports, filtering, formatting
- **Performance Optimized**: Minimal overhead logging
- **Integration**: Seamless context integration

### Plugin Usage:

```typescript
import { LoggerPlugin } from '@/plugins/logger';

const loggerPlugin = new LoggerPlugin({
  level: 'info',
  transports: [
    new ConsoleTransport(),
    new FileTransport({ filename: 'app.log' }),
  ],
});

loggerPlugin.install(app);
```

---

## Performance Design

### Performance Characteristics:

- **Response Time**: 0.01-0.08ms average (sub-millisecond)
- **Memory Usage**: 53.90MB average heap usage
- **Throughput**: 10,000+ requests/second capability
- **CPU Efficiency**: <50% utilization under load

### Optimization Strategies:

#### 1. **Efficient Data Structures**

- Map-based route storage for O(1) lookups
- Set-based middleware deduplication
- Buffer pools for memory management

#### 2. **Caching Systems**

- Route matching result caching
- Content-type detection caching
- Parsed parameter caching

#### 3. **Memory Management**

- Lazy property initialization
- Efficient object pooling
- Garbage collection optimization

#### 4. **Algorithmic Optimizations**

- Optimized path splitting algorithms
- Parameter extraction caching
- Middleware chain short-circuiting

---

## Migration from v1

### Key Changes:

1. **Architecture**: Monolithic → Orchestrated
2. **Dependencies**: Multiple → Zero runtime deps
3. **Context**: Express-style → Koa-style with Express compatibility
4. **Performance**: ~2,000 req/s → 10,000+ req/s capability
5. **Type Safety**: Partial → Comprehensive TypeScript

### Migration Steps:

1. **Update Dependencies**:

```bash
# Remove v1
npm uninstall nextrush

# Install v2
npm install nextrush@2.0.0-alpha.1
```

2. **Update Application Code**:

```typescript
// v1 Style
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

// v2 Style
app.get('/users', async ctx => {
  ctx.res.json({ users: [] });
  // or
  ctx.body = { users: [] };
});
```

3. **Update Middleware**:

```typescript
// v1 Style
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// v2 Style
app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await next();
});
```

---

## Development Guidelines

### Code Organization:

```
src/
├── core/                 # Built-in functionality
│   ├── app/             # Application classes
│   ├── middleware/      # Built-in middleware
│   ├── di/              # Dependency injection
│   └── orchestration/   # Orchestration layer
├── plugins/             # Optional advanced features
├── types/               # TypeScript definitions
└── utils/               # Utility functions
```

### Testing Strategy:

- **Unit Tests**: 517 comprehensive tests
- **Integration Tests**: End-to-end scenarios
- **Performance Tests**: Benchmarking and profiling
- **Coverage**: Core functionality fully tested

### Build System:

- **TypeScript**: Full type compilation
- **Bundle Formats**: CommonJS, ESM, TypeScript definitions
- **Development**: Live reload with tsup
- **Production**: Optimized builds with tree-shaking

---

## Future Roadmap

### Upcoming Features:

- WebSocket plugin integration
- Database plugin ecosystem
- Advanced caching strategies
- Microservice orchestration support
- GraphQL integration plugin

### Performance Targets:

- **Sub-millisecond p99 latency**
- **20,000+ req/s throughput**
- **<30MB memory footprint**
- **Zero-copy request processing**

---

_NextRush v2 represents a complete architectural evolution, delivering enterprise-grade performance while maintaining developer experience excellence._

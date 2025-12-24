# Orchestration Module

> Application orchestration layer for NextRush v2 - coordinates all application components following Single Responsibility Principle

## Overview

The Orchestration module provides a clean separation of concerns by coordinating between different application components. It implements the Mediator pattern to manage interactions between routes, middleware, server lifecycle, and request handling.

## Architecture

### System Overview

```mermaid
flowchart TB
    subgraph "Orchestration Layer"
        AO[ApplicationOrchestrator]
        RR[RouteRegistry]
        MC[MiddlewareChain]
        SM[ServerManager]
    end

    subgraph "Request Flow"
        REQ[HTTP Request] --> SM
        SM --> AO
        AO --> MC
        MC --> RR
        RR --> HANDLER[Route Handler]
        HANDLER --> RES[HTTP Response]
    end

    subgraph "Component Responsibilities"
        RR_RESP[Route Management]
        MC_RESP[Middleware Execution]
        SM_RESP[Server Lifecycle]
    end

    AO --> RR
    AO --> MC
    AO --> SM
    RR -.-> RR_RESP
    MC -.-> MC_RESP
    SM -.-> SM_RESP
```

### Request Lifecycle

```mermaid
sequenceDiagram
    participant C as Client
    participant SM as ServerManager
    participant AO as ApplicationOrchestrator
    participant MC as MiddlewareChain
    participant RR as RouteRegistry
    participant H as Handler
    participant EF as ExceptionFilter

    C->>SM: HTTP Request
    SM->>AO: handleRequest(req, res)
    AO->>AO: createContext()
    AO->>EF: findExceptionFilter()

    alt Has Exception Filter
        AO->>MC: executeMiddlewareWithBoundary(ctx)
        MC-->>AO: Done
        AO->>RR: findRoute(method, path)
        RR-->>AO: RouteMatch
        AO->>H: handler(ctx)
        H-->>AO: Response
    else Error Occurred
        AO->>EF: catch(error, ctx)
        EF-->>AO: Error Response
    end

    AO->>AO: releaseContext(ctx)
    AO->>SM: Response
    SM->>C: HTTP Response
```

### Component Relationships

```mermaid
mindmap
  root((Orchestration))
    ApplicationOrchestrator
      Coordinates all components
      Handles request lifecycle
      Manages error boundaries
      Emits lifecycle events
    RouteRegistry
      Route registration
      Route matching
      Sub-router support
      Route statistics
    MiddlewareChain
      Middleware composition
      Chain execution
      Cache invalidation
      Performance optimization
    ServerManager
      HTTP server lifecycle
      Port binding
      Graceful shutdown
      Signal handling
```

## File Structure

```
src/core/orchestration/
├── index.ts                    # Module exports
├── application-orchestrator.ts # Main orchestrator (200 lines)
├── middleware-chain.ts         # Middleware management (115 lines)
├── route-registry.ts           # Route management (115 lines)
└── server-manager.ts           # Server lifecycle (165 lines)
```

## Key Components

### ApplicationOrchestrator

The central coordinator that ties all components together:

```typescript
import { ApplicationOrchestrator } from '@/core/orchestration';

const orchestrator = new ApplicationOrchestrator(options);

// Access components
const routeRegistry = orchestrator.getRouteRegistry();
const middlewareChain = orchestrator.getMiddlewareChain();
const serverManager = orchestrator.getServerManager();

// Start server
await orchestrator.listen(3000, 'localhost', () => {
  console.log('Server running');
});

// Get statistics
const stats = orchestrator.getStats();
console.log(stats.routes);      // Route statistics
console.log(stats.middleware);  // Middleware statistics
console.log(stats.server);      // Server information
```

**Key Features**:
- Coordinates between RouteRegistry, MiddlewareChain, and ServerManager
- Handles request lifecycle with error boundaries
- Manages context creation and release
- Emits lifecycle events (listening, close, shutdown, error)

### MiddlewareChain

Koa-style middleware composition with caching:

```typescript
import { MiddlewareChain } from '@/core/orchestration';

const chain = new MiddlewareChain();

// Add middleware
chain.use(async (ctx, next) => {
  console.log('Before');
  await next();
  console.log('After');
});

// Execute chain
await chain.execute(ctx);

// Get statistics
console.log(chain.getStats());
// { count: 1, middleware: ['anonymous'] }
```

**Key Features**:
- Lazy composition (only recomposes when chain changes)
- Prevents multiple `next()` calls
- Named middleware tracking
- Performance-optimized execution

### RouteRegistry

Route management with sub-router support:

```typescript
import { RouteRegistry } from '@/core/orchestration';

const registry = new RouteRegistry();

// Register routes
registry.registerRoute('GET', '/users', handler);
registry.registerRoute('POST', '/users', createHandler);
registry.registerRoute('GET', '/users/:id', getByIdHandler);

// Find route
const match = registry.findRoute('GET', '/users/123');
console.log(match?.params);  // { id: '123' }

// Create and mount sub-router
const userRouter = registry.createRouter();
registry.registerRouter('/api', userRouter);
```

**Key Features**:
- HTTP method-based routing
- Dynamic parameter extraction
- Sub-router mounting with prefixes
- Route statistics

### ServerManager

HTTP server lifecycle management:

```typescript
import { ServerManager } from '@/core/orchestration';

const server = new ServerManager(options, requestHandler);

// Start server
await server.listen(3000, 'localhost', () => {
  console.log('Server started');
});

// Get server info
const info = server.getServerInfo();
console.log(info.listening);     // true
console.log(info.port);          // 3000
console.log(info.shuttingDown);  // false

// Graceful shutdown
await server.close();
```

**Key Features**:
- Graceful startup and shutdown
- Signal handling (SIGTERM, SIGINT)
- Connection tracking
- Event emission for lifecycle events

## Class Diagram

```mermaid
classDiagram
    class ApplicationOrchestrator {
        -routeRegistry: RouteRegistry
        -middlewareChain: MiddlewareChain
        -serverManager: ServerManager
        -options: ApplicationOptions
        +getRouteRegistry(): RouteRegistry
        +getMiddlewareChain(): MiddlewareChain
        +getServerManager(): ServerManager
        +listen(port, hostname, callback): Promise
        +close(): Promise
        +getStats(): Stats
    }

    class MiddlewareChain {
        -middleware: Middleware[]
        -composed: Function
        -isDirty: boolean
        +use(middleware): void
        +execute(ctx): Promise
        +getStats(): Stats
        +clear(): void
        +isEmpty(): boolean
    }

    class RouteRegistry {
        -internalRouter: Router
        +registerRoute(method, path, handler): void
        +findRoute(method, path): RouteMatch
        +createRouter(): Router
        +registerRouter(prefix, router): void
        +getRouteStats(): Stats
    }

    class ServerManager {
        -server: Server
        -options: ApplicationOptions
        -isShuttingDown: boolean
        +createServer(): Server
        +listen(port, hostname, callback): Promise
        +close(): Promise
        +getServerInfo(): ServerInfo
    }

    ApplicationOrchestrator --> RouteRegistry
    ApplicationOrchestrator --> MiddlewareChain
    ApplicationOrchestrator --> ServerManager
```

## Event Flow

```mermaid
flowchart LR
    subgraph "ServerManager Events"
        SM_LISTEN[listening]
        SM_ERROR[error]
        SM_CLOSE[close]
        SM_SHUTDOWN[shutdown]
    end

    subgraph "ApplicationOrchestrator Events"
        AO_LISTEN[listening]
        AO_ERROR[error]
        AO_CLOSE[close]
        AO_SHUTDOWN[shutdown]
    end

    SM_LISTEN --> AO_LISTEN
    SM_ERROR --> AO_ERROR
    SM_CLOSE --> AO_CLOSE
    SM_SHUTDOWN --> AO_SHUTDOWN
```

## Middleware Composition

```mermaid
flowchart TD
    subgraph "Composition"
        MW1[Middleware 1]
        MW2[Middleware 2]
        MW3[Middleware 3]
        HANDLER[Route Handler]
    end

    subgraph "Execution Order"
        direction TB
        B1[MW1 Before] --> B2[MW2 Before]
        B2 --> B3[MW3 Before]
        B3 --> H[Handler]
        H --> A3[MW3 After]
        A3 --> A2[MW2 After]
        A2 --> A1[MW1 After]
    end

    MW1 --> MW2
    MW2 --> MW3
    MW3 --> HANDLER
```

## Usage Example

```typescript
import {
  ApplicationOrchestrator,
  MiddlewareChain,
  RouteRegistry,
  ServerManager
} from '@/core/orchestration';

// Create orchestrator with options
const options = {
  port: 3000,
  host: 'localhost',
  // ... other options
};

const orchestrator = new ApplicationOrchestrator(options);

// Add middleware
orchestrator.getMiddlewareChain().use(async (ctx, next) => {
  const start = Date.now();
  await next();
  console.log(`${ctx.method} ${ctx.path} - ${Date.now() - start}ms`);
});

// Register routes
const registry = orchestrator.getRouteRegistry();
registry.registerRoute('GET', '/', ctx => {
  ctx.body = { message: 'Hello World' };
});

// Start server
await orchestrator.listen(3000, 'localhost', () => {
  console.log('Server running on http://localhost:3000');
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await orchestrator.close();
  process.exit(0);
});
```

## Dependencies

```mermaid
flowchart TD
    ORCH[Orchestration Module] --> APP[App Module]
    ORCH --> ROUTER[Router Module]
    ORCH --> ENHANCERS[Enhancers Module]
    ORCH --> ERRORS[Errors Module]
    ORCH --> TYPES[Types]
```

## Design Principles

1. **Single Responsibility**: Each class has one reason to change
2. **Separation of Concerns**: Clear boundaries between components
3. **Event-Driven**: Lifecycle events for extensibility
4. **Lazy Evaluation**: Middleware composed only when changed
5. **Error Boundaries**: Protected execution with exception handling

## Testing

```bash
# Run orchestration tests
pnpm test src/tests/unit/core/orchestration/

# Run integration tests
pnpm test src/tests/integration/orchestration/
```

## See Also

- [Application Module](../app/README.md) - Main application
- [Router Module](../router/README.md) - Route matching
- [Enhancers Module](../enhancers/README.md) - Request/Response enhancement
- [Middleware Module](../middleware/README.md) - Built-in middleware

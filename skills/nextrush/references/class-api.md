# NextRush Class-Based API Reference

Full API surface for `import { ... } from 'nextrush/class'`.

## Decorator Import Map

```typescript
import {
  // Class decorators
  Controller, Service, Repository, Module,

  // Route decorators
  Get, Post, Put, Delete, Patch, Head, Options, All,

  // Parameter decorators
  Body, Param, Query, Header, Ctx, Req, Res,
  createCustomParamDecorator,

  // Response decorators
  HttpCode, Redirect, SetHeader,

  // DI
  inject, container, createContainer,

  // Guards
  UseGuard, GuardContext, type Guard, type GuardFn, type CanActivate,

  // Interceptors
  UseInterceptor, type Interceptor,

  // Exception filters
  Catch, UseFilter, type ExceptionFilter,

  // Registration
  registerControllers, registerModule, ControllerRegistry,

  // Discovery
  discoverControllers, FilesystemSource, MemorySource,

  // Lifecycle hooks (duck-typed, no decorator needed)
  type OnInit, type OnShutdown,

  // Module
  registerModule, collectModuleControllers, collectModuleGraph,

  // Diagnostics
  getClassDiagnostics, type DiagnosticsReport,

  // Errors
  ControllerError, ControllerResolutionError, DiscoveryError,
  GuardRejectionError, NotAControllerError, RouteRegistrationError,

  // Types
  type ControllerOptions, type ControllerMetadata, type RouteOptions,
  type RouteMetadata, type ParamOptions, type ParamSource,
  type Constructor, type DiscoveryOptions, type BuiltRoute,
} from 'nextrush/class';
```

## Controller Decorator

```typescript
@Controller(pathOrOptions?: string | ControllerOptions)

interface ControllerOptions {
  path?: string;        // base path (default: derived from class name)
  version?: string;      // API version
  middleware?: Middleware[]; // controller-level middleware
  tags?: string[];        // OpenAPI tags
}
```

## Route Decorators

Each accepts optional path and options:

```typescript
@Get(pathOrOptions?: string | RouteOptions, options?: RouteOptions)
@Post(...)
@Put(...)
@Delete(...)
@Patch(...)
@Head(...)
@Options(...)
@All(...)

interface RouteOptions {
  path?: string;
  description?: string;
  statusCode?: number;
  deprecated?: boolean;
  middleware?: Middleware[];
}
```

## Parameter Decorators

```typescript
// Inject parsed request body (requires body-parser middleware)
@Body(options?: BodyOptions)

// Inject route parameter
@Param(name: string, options?: ParamOptions)
// Example: @Param('id', { transform: Number }) id: number

// Inject query parameter
@Query(name?: string, options?: QueryOptions)
// Without name: injects entire query object
// With name: injects specific query param

// Inject request header
@Header(name: string)

// Inject full Context object
@Ctx()

// Inject raw Request/Response (escape hatch)
@Req()
@Res()

// Custom parameter decorator
const CurrentUser = createCustomParamDecorator((ctx) => ctx.get('user'));
// Usage: method(@CurrentUser() user: User) {}
```

## Service & DI

```typescript
@Service()
class UserService {
  findAll() { ... }
}

// Constructor injection — auto-resolved by type
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {} // auto-injected
}

// Custom token injection
const API_KEY = Symbol('API_KEY');
container.register(API_KEY, { useValue: 'secret-key' });

class MyService {
  constructor(@inject(API_KEY) private apiKey: string) {}
}

// Create isolated container
const testContainer = createContainer();
testContainer.register(UserService, { useClass: MockUserService });
```

## Guards

Guards implement `CanActivate` interface:

```typescript
import { CanActivate, GuardContext, UseGuard } from 'nextrush/class';

class AuthGuard implements CanActivate {
  canActivate(ctx: GuardContext): boolean | Promise<boolean> {
    const token = ctx.get('authorization');
    return token === 'Bearer secret';
  }
}

// Method level
@Get('/profile')
@UseGuard(AuthGuard)
getProfile() { ... }

// Class level (applies to all methods)
@Controller('/admin')
@UseGuard(AuthGuard)
class AdminController { ... }

// Multiple guards (executed in order)
@UseGuard(AuthGuard, RoleGuard, RateLimitGuard)
```

Guard's `canActivate()` returns `false` → throws `GuardRejectionError` (403).

## Interceptors

Interceptors wrap handler execution:

```typescript
import { UseInterceptor, type Interceptor } from 'nextrush/class';

class LogInterceptor implements Interceptor {
  async intercept(ctx: Context, next: () => Promise<any>) {
    console.log(`→ ${ctx.method} ${ctx.path}`);
    const result = await next();
    console.log(`← ${ctx.status}`);
    return result;
  }
}

// Method level
@Get()
@UseInterceptor(LogInterceptor)
findAll() { ... }
```

## Exception Filters

```typescript
import { Catch, UseFilter, type ExceptionFilter } from 'nextrush/class';

@Catch(NotFoundError)
class NotFoundFilter implements ExceptionFilter {
  catch(error: NotFoundError, ctx: Context) {
    ctx.status = 404;
    ctx.json({ message: error.message, code: 'NOT_FOUND' });
  }
}

// Method level
@Get('/:id')
@UseFilter(NotFoundFilter)
findById(@Param('id') id: string) { ... }
```

## Lifecycle Hooks (duck-typed)

```typescript
import type { OnInit, OnShutdown } from 'nextrush/class';

@Service()
class DatabaseService implements OnInit, OnShutdown {
  async onInit() {
    await this.connect();
  }

  async onShutdown() {
    await this.disconnect();
  }
}
```

## Module System

```typescript
import { Module, registerModule } from 'nextrush/class';

@Module({
  controllers: [UserController, AdminController],
  providers: [UserService, AuthService],
  imports: [DatabaseModule],   // import other modules
  exports: [UserService],       // export providers for other modules
})
class AppModule {}

await registerModule(app, AppModule, { prefix: '/api/v1' });
```

## Controller Registration

```typescript
await registerControllers(app, {
  root: './src',                    // directory to scan for controllers
  prefix: '/api',                   // path prefix for all discovered routes
  pattern: /\.controller\.ts$/,     // file matching pattern
  container: customContainer,       // custom DI container
  exclude: [/\.test\./, /\.spec\./],// files to exclude
});

// With custom discovery source
import { FilesystemSource } from 'nextrush/class';
await registerControllers(app, {
  source: new FilesystemSource({ root: './dist' }),
});
```

## Diagnostics

```typescript
import { getClassDiagnostics } from 'nextrush/class';

const report = await getClassDiagnostics('./src');
// report.circularDependencies: CircularDependency[]
// report.duplicateRoutes: DuplicateRoute[]
// report.timing: TimingEntry[]
```

## MiddlewareOrdering

```
Request → Controller-level middleware → Guard(s) → Interceptor(s) → Handler → Interceptor post-processing → Response
```

Guards run before interceptors. Interceptors wrap the handler (before + after). Controller-level middleware runs first.

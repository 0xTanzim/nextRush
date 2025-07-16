# 🏗️ NextRush Monolithic Package Strategy

## 📋 Executive Summary

Based on your clarification, we're implementing **everything in ONE unified package** for now. All features (decorators, validation, auth, file upload, etc.) will be **built-in and available immediately** without any plugin system. Future plans include a separate modular package with cleaner architecture.

---

## 🎯 **Revised Architecture: All-in-One Package**

### **Single Package Import**

```typescript
// Everything available from main package
import {
  createApp,
  Controller,
  GET,
  POST,
  PUT,
  DELETE,
  Auth,
  Guard,
  Validate,
  validate,
  auth,
  cache,
  SimpleContainer,
} from 'nextrush';

const app = createApp();

// All features built-in and ready to use
```

### **No Plugin System - Direct Integration**

```typescript
// Before (Plugin-based - REMOVED)
// import { decoratorPlugin, authPlugin } from 'nextrush/plugins';
// app.use(decoratorPlugin()).use(authPlugin());

// After (Built-in - CURRENT PLAN)
import { createApp, Controller, Auth } from 'nextrush';

const app = createApp();

// Decorators work immediately
@Controller('/api')
class ApiController {
  @GET('/users')
  @Auth.required()
  getUsers() {
    /* works out of the box */
  }
}

app.registerController(ApiController);
```

---

## 🔧 **Implementation Structure**

### **Core Package Structure**

```
nextrush/
├── src/
│   ├── core/
│   │   ├── application.ts         // Main app class
│   │   └── event-system.ts        // Event handling
│   ├── routing/
│   │   ├── router.ts              // Express-style routing
│   │   └── decorators.ts          // @GET, @POST decorators
│   ├── middleware/
│   │   ├── built-in.ts            // CORS, compression, etc.
│   │   ├── auth.ts                // Authentication system
│   │   └── validation.ts          // Schema validation
│   ├── http/
│   │   ├── request/
│   │   │   ├── body-parser.ts     // File upload + parsing
│   │   │   └── enhanced-request.ts
│   │   └── response/
│   ├── decorators/
│   │   ├── controller.ts          // @Controller
│   │   ├── routes.ts              // @GET, @POST, etc.
│   │   ├── guards.ts              // @Auth, @Guard
│   │   └── validation.ts          // @Validate
│   ├── di/
│   │   └── container.ts           // Simple DI container
│   ├── session/
│   │   └── session-manager.ts     // Session handling
│   ├── cache/
│   │   └── cache-manager.ts       // Caching system
│   ├── health/
│   │   └── health-checks.ts       // Health monitoring
│   └── index.ts                   // Main export
```

### **Single Main Export**

```typescript
// src/index.ts - Everything exported from one place
export { Application, createApp } from './core/application';
export { Router } from './routing/router';

// Decorators (built-in)
export {
  Controller,
  GET,
  POST,
  PUT,
  DELETE,
  PATCH,
  Auth,
  Guard,
  Validate,
  Cache,
} from './decorators';

// Middleware functions
export { validate, auth, cache, cors, helmet, compression } from './middleware';

// Utilities
export { SimpleContainer } from './di/container';
export { SessionManager } from './session/session-manager';

// Types
export * from './types';
```

---

## 🎨 **Usage Examples (Monolithic)**

### **Scenario 1: Express-style (Simple)**

```typescript
import { createApp, validate, auth } from 'nextrush';

const app = createApp();

const userSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' },
  },
};

// All features built-in
app.post(
  '/users',
  validate(userSchema), // Built-in validation
  auth.required(), // Built-in auth
  (req, res) => {
    res.json({ user: req.body });
  }
);

app.listen(3000);
```

### **Scenario 2: OOP with Decorators (Advanced)**

```typescript
import {
  createApp,
  Controller,
  GET,
  POST,
  Auth,
  Validate,
  Cache,
  SimpleContainer,
} from 'nextrush';

// Register services
SimpleContainer.register('userService', () => new UserService());

@Controller('/api/users')
class UserController {
  private userService = SimpleContainer.resolve('userService');

  @GET('/')
  @Auth.required()
  @Cache('5m')
  async getUsers(req, res) {
    const users = await this.userService.findAll();
    res.json(users);
  }

  @POST('/')
  @Auth.requireRole('admin')
  @Validate(userSchema)
  async createUser(req, res) {
    const user = await this.userService.create(req.body);
    res.status(201).json(user);
  }
}

const app = createApp();
app.registerController(UserController);
app.listen(3000);
```

### **Scenario 3: Mixed Styles**

```typescript
import { createApp, Controller, GET, auth } from 'nextrush';

const app = createApp();

// Simple routes - Express style
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/ping', (req, res) => res.send('pong'));

// Complex business logic - OOP style
@Controller('/api')
class ApiController {
  @GET('/dashboard')
  @Auth.required()
  getDashboard(req, res) {
    res.json({ user: req.user, data: 'dashboard' });
  }
}

app.registerController(ApiController);
app.listen(3000);
```

---

## 🔧 **Built-in Features Implementation**

### **1. Authentication (Built-in)**

```typescript
// src/middleware/auth.ts
export class AuthSystem {
  private static config: AuthConfig;

  static configure(config: AuthConfig) {
    this.config = config;
  }

  static required() {
    return (req: any, res: any, next: any) => {
      // JWT validation logic
      const token = req.headers.authorization?.replace('Bearer ', '');
      const user = this.validateToken(token);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      req.user = user;
      next();
    };
  }

  static requireRole(role: string) {
    return (req: any, res: any, next: any) => {
      if (!req.user?.roles?.includes(role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    };
  }
}

// Export convenience function
export const auth = AuthSystem;
```

### **2. Validation (Built-in)**

```typescript
// src/middleware/validation.ts
export function validate(schema: ValidationSchema) {
  return (req: any, res: any, next: any) => {
    const result = validateSchema(req.body, schema);
    if (!result.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.errors,
      });
    }
    next();
  };
}

// Built-in JSON Schema validator
function validateSchema(data: any, schema: ValidationSchema) {
  // Implementation without dependencies
}
```

### **3. Decorators (Built-in)**

```typescript
// src/decorators/controller.ts
export function Controller(basePath: string) {
  return function (target: any) {
    Reflect.defineMetadata('controller:path', basePath, target);
  };
}

// src/decorators/routes.ts
export function GET(path: string = '/') {
  return function (target: any, propertyKey: string) {
    addRoute(target, propertyKey, 'GET', path);
  };
}

export function POST(path: string = '/') {
  return function (target: any, propertyKey: string) {
    addRoute(target, propertyKey, 'POST', path);
  };
}

// src/decorators/guards.ts
export class Auth {
  static required() {
    return function (target: any, propertyKey: string) {
      addGuard(target, propertyKey, 'auth', { required: true });
    };
  }

  static requireRole(role: string) {
    return function (target: any, propertyKey: string) {
      addGuard(target, propertyKey, 'role', { role });
    };
  }
}

export class Validate {
  static schema(schema: ValidationSchema) {
    return function (target: any, propertyKey: string) {
      addGuard(target, propertyKey, 'validation', { schema });
    };
  }
}
```

### **4. Enhanced Application Class**

```typescript
// src/core/application.ts
export class Application {
  // ...existing code...

  /**
   * Configure authentication (built-in)
   */
  useAuth(config: AuthConfig): this {
    AuthSystem.configure(config);
    return this;
  }

  /**
   * Configure sessions (built-in)
   */
  useSession(config: SessionConfig): this {
    SessionManager.configure(config);
    this.use(SessionManager.middleware());
    return this;
  }

  /**
   * Register controller (built-in)
   */
  registerController(ControllerClass: any): this {
    ControllerRegistry.register(this, ControllerClass);
    return this;
  }

  /**
   * Enable health checks (built-in)
   */
  enableHealthChecks(config: HealthConfig): this {
    HealthChecker.configure(config);
    this.get('/health', HealthChecker.handler());
    return this;
  }

  /**
   * Enable caching (built-in)
   */
  useCache(config: CacheConfig): this {
    CacheManager.configure(config);
    return this;
  }
}
```

---

## 🎯 **Implementation Timeline (Revised)**

### **Phase 1: Core Features (Weeks 1-4)**

- **Week 1-2**: Enhanced body parser + file upload
- **Week 3-4**: Built-in validation system

### **Phase 2: Authentication & OOP (Weeks 5-8)**

- **Week 5-6**: Built-in authentication system
- **Week 7-8**: Built-in decorator support

### **Phase 3: Advanced Features (Weeks 9-12)**

- **Week 9-10**: Session management + caching
- **Week 11-12**: Health checks + monitoring

### **Phase 4: Polish & Testing (Weeks 13-16)**

- **Week 13-14**: Performance optimization
- **Week 15-16**: Documentation + examples

---

## 🚀 **Benefits of Monolithic Approach**

### **Immediate Benefits**

- ✅ **Zero configuration** - everything works out of the box
- ✅ **Single import** - no plugin management
- ✅ **Consistent API** - all features follow same patterns
- ✅ **Better performance** - no plugin overhead
- ✅ **Simpler debugging** - single codebase

### **Developer Experience**

- ✅ **Faster setup** - npm install + import
- ✅ **Better IntelliSense** - all types available
- ✅ **Single documentation** - everything in one place
- ✅ **Consistent versioning** - no plugin compatibility issues

### **Future Migration Path**

- 🔄 **Clean separation** - features already modularized internally
- 🔄 **Easy extraction** - can split into packages later
- 🔄 **Backward compatibility** - API remains same
- 🔄 **Progressive enhancement** - modular version can be additive

---

## 📦 **Package.json (Monolithic)**

```json
{
  "name": "nextrush",
  "version": "2.0.0",
  "description": "Modern, fast, and feature-complete Node.js framework",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "reflect-metadata": "^0.1.13"
  },
  "peerDependencies": {
    "typescript": ">=4.5.0"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

**Note**: Only `reflect-metadata` dependency for decorators, everything else built natively.

---

## 🎯 **Summary**

This **monolithic approach** gives us:

1. **Immediate Power**: All features available instantly
2. **Zero Complexity**: No plugin system to manage
3. **Better Performance**: No plugin overhead
4. **Cleaner API**: Single, consistent interface
5. **Future Ready**: Internal architecture supports later modularization

The package will be **feature-complete** and **production-ready** while maintaining the simplicity that makes NextRush special! 🚀

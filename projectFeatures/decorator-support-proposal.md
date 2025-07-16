# 🎯 Decorator & OOP Support Proposal for NextRush

## 📋 Executive Summary

This proposal analyzes adding **decorator-based routing (@GET, @POST, @GUARD, @AUTH)** and **OOP-style development** to NextRush while maintaining our core principles of **simplicity**, **Express-like ease**, and **zero complexity**.

---

## 🎨 **Decorator Support Vision**

### **Target API Design**

```typescript
import {
  Controller,
  GET,
  POST,
  Guard,
  Auth,
  Inject,
} from 'nextrush/decorators';

@Controller('/api/users')
export class UserController {
  constructor(
    @Inject('userService') private userService: UserService,
    @Inject('logger') private logger: Logger
  ) {}

  @GET('/')
  @Auth.required()
  async getAllUsers(req: Request, res: Response) {
    const users = await this.userService.findAll();
    res.json(users);
  }

  @POST('/')
  @Auth.requireRole('admin')
  @Guard.validate(UserCreateSchema)
  async createUser(req: Request, res: Response) {
    const user = await this.userService.create(req.body);
    res.json(user);
  }

  @GET('/:id')
  @Guard.rateLimit({ max: 100, window: '15m' })
  async getUserById(req: Request, res: Response) {
    const user = await this.userService.findById(req.params.id);
    res.json(user);
  }
}

// Bootstrap with Express-like simplicity
const app = createApp();
app.registerController(UserController);
app.listen(3000);
```

---

## 🔍 **Compatibility Analysis**

### ✅ **Does NOT Break Current Design**

Our decorator system would be **100% additive**:

```typescript
// Current Express-style (KEEPS WORKING)
app.get('/users', async (req, res) => {
  res.json(await getUsersFromDB());
});

// New Decorator-style (OPTIONAL)
@Controller('/users')
class UserController {
  @GET('/')
  async getUsers(req, res) {
    res.json(await getUsersFromDB());
  }
}

// Both styles work together!
app.use('/api', router); // Express style
app.registerController(UserController); // Decorator style
```

### 🎯 **Implementation Strategy**

1. **Metadata Collection**: Use TypeScript experimental decorators
2. **Route Registration**: Convert decorated methods to standard routes
3. **Dependency Injection**: Simple IoC container (optional)
4. **Guard System**: Reuse existing middleware infrastructure

---

## 🛠 **Technical Implementation**

### **Core Decorator Infrastructure**

```typescript
// decorators/core.ts
export function Controller(basePath: string = '/') {
  return function (target: any) {
    Reflect.defineMetadata('controller:basePath', basePath, target);
  };
}

export function GET(path: string = '/') {
  return function (target: any, propertyKey: string) {
    const routes = Reflect.getMetadata('controller:routes', target) || [];
    routes.push({ method: 'GET', path, handler: propertyKey });
    Reflect.defineMetadata('controller:routes', routes, target);
  };
}

export function POST(path: string = '/') {
  return function (target: any, propertyKey: string) {
    const routes = Reflect.getMetadata('controller:routes', target) || [];
    routes.push({ method: 'POST', path, handler: propertyKey });
    Reflect.defineMetadata('controller:routes', routes, target);
  };
}
```

### **Guard System (Auth/Validation)**

```typescript
// decorators/guards.ts
export class Guard {
  static validate(schema: any) {
    return function (target: any, propertyKey: string) {
      const guards =
        Reflect.getMetadata('route:guards', target, propertyKey) || [];
      guards.push({ type: 'validation', schema });
      Reflect.defineMetadata('route:guards', guards, target, propertyKey);
    };
  }

  static rateLimit(options: { max: number; window: string }) {
    return function (target: any, propertyKey: string) {
      const guards =
        Reflect.getMetadata('route:guards', target, propertyKey) || [];
      guards.push({ type: 'rateLimit', options });
      Reflect.defineMetadata('route:guards', guards, target, propertyKey);
    };
  }
}

export class Auth {
  static required() {
    return function (target: any, propertyKey: string) {
      const guards =
        Reflect.getMetadata('route:guards', target, propertyKey) || [];
      guards.push({ type: 'auth', required: true });
      Reflect.defineMetadata('route:guards', guards, target, propertyKey);
    };
  }

  static requireRole(role: string) {
    return function (target: any, propertyKey: string) {
      const guards =
        Reflect.getMetadata('route:guards', target, propertyKey) || [];
      guards.push({ type: 'role', role });
      Reflect.defineMetadata('route:guards', guards, target, propertyKey);
    };
  }
}
```

### **Controller Registration**

```typescript
// controller-registry.ts
export class ControllerRegistry {
  static registerController(app: Application, ControllerClass: any) {
    const instance = new ControllerClass();
    const basePath =
      Reflect.getMetadata('controller:basePath', ControllerClass) || '/';
    const routes =
      Reflect.getMetadata('controller:routes', ControllerClass.prototype) || [];

    routes.forEach((route: any) => {
      const fullPath = this.combinePaths(basePath, route.path);
      const handler = instance[route.handler].bind(instance);
      const middlewares = this.buildMiddlewares(instance, route.handler);

      // Register with existing router
      app[route.method.toLowerCase()](fullPath, ...middlewares, handler);
    });
  }

  private static buildMiddlewares(instance: any, methodName: string) {
    const guards =
      Reflect.getMetadata('route:guards', instance, methodName) || [];
    return guards.map((guard: any) => this.guardToMiddleware(guard));
  }

  private static guardToMiddleware(guard: any) {
    switch (guard.type) {
      case 'auth':
        return (req: any, res: any, next: any) => {
          if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
          next();
        };
      case 'role':
        return (req: any, res: any, next: any) => {
          if (!req.user?.roles?.includes(guard.role)) {
            return res.status(403).json({ error: 'Forbidden' });
          }
          next();
        };
      case 'validation':
        return (req: any, res: any, next: any) => {
          // Validation logic using existing validation system
          next();
        };
      default:
        return (req: any, res: any, next: any) => next();
    }
  }
}

// Add to Application class
Application.prototype.registerController = function (ControllerClass: any) {
  ControllerRegistry.registerController(this, ControllerClass);
  return this;
};
```

---

## 💡 **Dependency Injection Strategy**

### **Option 1: TSyringe Integration**

```typescript
// Use existing TSyringe package
import { container, injectable, inject } from 'tsyringe';

@injectable()
@Controller('/users')
export class UserController {
  constructor(@inject('UserService') private userService: UserService) {}
}

// Simple setup
container.register('UserService', UserService);
app.registerController(UserController);
```

**Pros:**

- ✅ Mature, well-tested
- ✅ Small package (~50KB)
- ✅ Industry standard
- ✅ Excellent TypeScript support

**Cons:**

- ❌ External dependency (breaks zero-dependency goal)
- ❌ Adds complexity

### **Option 2: Built-in Mini DI Container**

```typescript
// di/container.ts
export class SimpleContainer {
  private static services = new Map<string, any>();
  private static singletons = new Map<string, any>();

  static register<T>(token: string, implementation: new (...args: any[]) => T) {
    this.services.set(token, implementation);
  }

  static registerSingleton<T>(token: string, instance: T) {
    this.singletons.set(token, instance);
  }

  static resolve<T>(token: string): T {
    if (this.singletons.has(token)) {
      return this.singletons.get(token);
    }

    const ServiceClass = this.services.get(token);
    if (!ServiceClass) {
      throw new Error(`Service ${token} not registered`);
    }

    // Simple instantiation (no complex dependency resolution)
    return new ServiceClass();
  }
}

// Usage
SimpleContainer.register('UserService', UserService);
SimpleContainer.registerSingleton('logger', new Logger());

@Controller('/users')
export class UserController {
  constructor() {
    this.userService = SimpleContainer.resolve('UserService');
  }
}
```

**Pros:**

- ✅ Zero dependencies
- ✅ Simple and lightweight
- ✅ Fits NextRush philosophy
- ✅ Easy to understand

**Cons:**

- ❌ Limited features (no circular dependency resolution)
- ❌ Manual constructor injection

### **🎯 Recommended Approach: Built-in (Monolithic)**

```typescript
// Everything built into main package - no plugins needed
import { createApp, Controller, Auth, SimpleContainer } from 'nextrush';

const app = createApp();

// Built-in simple DI (always available)
SimpleContainer.register('UserService', () => new UserService());
app.registerController(UserController);

// All features built-in and ready to use
@Controller('/api/users')
class UserController {
  @GET('/')
  @Auth.required()
  getUsers() {
    /* works immediately */
  }
}
```

---

## 🏗️ **Monolithic Architecture Design**

### **What is Monolithic Architecture?**

A monolithic system includes **all functionality in one package** without external dependencies:

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
@Controller('/api')
class ApiController {
  @GET('/users')
  @Auth.required()
  @Validate(userSchema)
  getUsers() {
    /* works out of the box */
  }
}

app.registerController(ApiController);
```

### **Benefits of Monolithic Approach**

1. **📦 Zero Configuration**: Everything works out of the box
2. **🚀 Better Performance**: No plugin overhead
3. **🎯 Single Import**: All features from one package
4. **� Consistent API**: Unified development experience
5. **🧪 Easier Testing**: Single codebase to test

---

## 🎯 **Implementation Roadmap**

### **Phase 1: Foundation (Week 1-2)**

- [ ] Metadata reflection setup
- [ ] Basic decorator infrastructure
- [ ] Simple DI container
- [ ] Controller registry

### **Phase 2: Core Decorators (Week 3-4)**

- [ ] @Controller, @GET, @POST, @PUT, @DELETE
- [ ] @Guard basic implementation
- [ ] @Auth basic implementation
- [ ] Route registration integration

### **Phase 3: Advanced Features (Week 5-6)**

- [ ] @Validate decorator
- [ ] @RateLimit decorator
- [ ] @Cache decorator
- [ ] Built-in feature integration

### **Phase 4: Testing & Polish (Week 7-8)**

- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Documentation updates

---

## 🎪 **Example Usage Scenarios**

### **Scenario 1: REST API with Authentication**

```typescript
@Controller('/api/products')
export class ProductController {
  @GET('/')
  @Guard.rateLimit({ max: 100, window: '15m' })
  async getAllProducts(req: Request, res: Response) {
    const products = await ProductService.findAll();
    res.json(products);
  }

  @POST('/')
  @Auth.requireRole('admin')
  @Guard.validate(CreateProductSchema)
  async createProduct(req: Request, res: Response) {
    const product = await ProductService.create(req.body);
    res.status(201).json(product);
  }

  @PUT('/:id')
  @Auth.required()
  @Guard.validate(UpdateProductSchema)
  async updateProduct(req: Request, res: Response) {
    const product = await ProductService.update(req.params.id, req.body);
    res.json(product);
  }
}
```

### **Scenario 2: Mixed Programming Styles**

```typescript
// Express style (simple endpoints)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Decorator style (complex business logic)
@Controller('/api/users')
class UserController {
  @GET('/')
  @Auth.required()
  async getUsers(req, res) {
    // Complex user management logic
  }
}

// Both work together seamlessly!
```

### **Scenario 3: Progressive Feature Usage**

```typescript
// Start simple
import { createApp, auth, validate, Controller, GET } from 'nextrush';

const app = createApp();

// Add features as needed
if (needsAuth) {
  app.useAuth({ strategies: ['jwt'] });
}

if (needsComplexLogic) {
  @Controller('/api')
  class ApiController {
    @GET('/data')
    @auth.required()
    getData(req, res) {
      res.json({});
    }
  }

  app.registerController(ApiController);
}
```

---

## 🎯 **Final Recommendation**

### ✅ **YES - Implement Decorator Support**

**Reasoning:**

1. **Additive Enhancement**: Doesn't break existing Express-style usage
2. **Developer Choice**: OOP lovers get their preferred style
3. **Enterprise Appeal**: Makes NextRush attractive to large teams
4. **Modern Standards**: Aligns with NestJS/Spring Boot patterns
5. **Built-in Features**: Everything available immediately

### 📋 **Implementation Priorities**

1. **High Priority**: @GET, @POST, @Controller, basic @Auth
2. **Medium Priority**: @Guard, @Validate, simple DI
3. **Low Priority**: Advanced DI features, enhanced caching

### 🎨 **Design Principles**

- **Express-style FIRST**: Keep existing API as primary
- **Decorators OPTIONAL**: Built-in but not required
- **Zero Dependencies**: Built-in simple DI, everything included
- **Simple Setup**: One-line controller registration
- **Progressive Enhancement**: Start simple, add complexity as needed

This approach gives us the **best of both worlds**: Express simplicity for quick development and decorator elegance for complex applications! 🚀

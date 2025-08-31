---
applyTo: '**/*.ts'
description: 'NextRush v2 Coding Guidelines'
---

# 📝 NextRush v2 Coding Guidelines

## 🎯 **Core Principles**

### **1. Type Safety First**

```typescript
// ✅ ALWAYS use proper types
import type { Context, Middleware, RouteHandler } from '@/types/context';

const middleware: Middleware = async (ctx: Context, next) => {
  // Type-safe implementation
  await next();
};

// ❌ NEVER use 'any'
const badMiddleware = async (ctx: any, next: any) => {
  // This is wrong!
};
```

### **2. SOLID Principles**

```typescript
// ✅ Single Responsibility Principle
class UserService {
  async findById(id: string): Promise<User | null> {
    // Only handles user retrieval
  }
}

class UserController {
  constructor(private userService: UserService) {}

  async getUser(ctx: Context): Promise<void> {
    // Only handles HTTP concerns
  }
}

// ✅ Open/Closed Principle
abstract class BasePlugin {
  abstract install(app: Application): void;
  abstract name: string;
}

class LoggerPlugin extends BasePlugin {
  name = 'Logger';
  install(app: Application) {
    // Implementation
  }
}
```

### **3. Performance Optimization**

```typescript
// ✅ Efficient data structures
const routeMap = new Map<string, RouteHandler>(); // O(1) lookup
const middlewareSet = new Set<Middleware>(); // Unique middleware

// ✅ Memory management
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

---

## 📁 **File Structure Guidelines**

### **1. Core Files (src/core/)**

```
src/core/
├── app/
│   ├── application.ts      # Main application class
│   └── context.ts         # Context creation/management
├── middleware/
│   ├── cors.ts           # CORS middleware
│   ├── helmet.ts         # Security middleware
│   ├── compression.ts    # Compression middleware
│   └── types.ts          # Middleware type definitions
├── router/
│   └── index.ts          # Router implementation
├── enhancers/
│   ├── request-enhancer.ts  # Request enhancement
│   └── response-enhancer.ts # Response enhancement
└── di/
    ├── container.ts       # DI container
    └── index.ts          # DI exports
```

### **2. Plugin Files (src/plugins/)**

```
src/plugins/
├── logger/
│   ├── logger.plugin.ts   # Main plugin class
│   ├── transports.ts      # Transport implementations
│   └── index.ts          # Plugin exports
├── database/
│   ├── database.plugin.ts # Database plugin
│   └── index.ts          # Database exports
└── websocket/
    ├── websocket.plugin.ts # WebSocket plugin
    └── index.ts          # WebSocket exports
```

### **3. Type Files (src/types/)**

```
src/types/
├── context.ts            # Context types
├── http.ts              # HTTP types
├── plugin.ts            # Plugin types
└── index.ts             # Type exports
```

---

## 🔧 **Code Quality Standards**

### **1. File Size Limits**

- **Core files**: 150-350 lines maximum
- **Plugin files**: 200-400 lines maximum
- **Type files**: 100-200 lines maximum
- **Test files**: 100-300 lines maximum

### **2. Function Complexity**

```typescript
// ✅ Simple, focused functions
async function validateUser(user: User): Promise<ValidationResult> {
  const errors: string[] = [];

  if (!user.email) {
    errors.push('Email is required');
  }

  if (!user.name) {
    errors.push('Name is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ❌ Complex, multi-purpose functions
async function processUserData(user: any, options: any, callback: any) {
  // Too many responsibilities
}
```

### **3. Error Handling**

```typescript
// ✅ Proper error handling
async function createUser(userData: CreateUserDto): Promise<User> {
  try {
    const user = await userRepository.create(userData);
    return user;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new BadRequestError('Invalid user data');
    }
    if (error instanceof ConflictError) {
      throw new ConflictError('User already exists');
    }
    throw new InternalServerError('Failed to create user');
  }
}
```

---

## 🧪 **Testing Guidelines**

### **1. Test Structure**

```typescript
// ✅ Comprehensive test structure
describe('UserService', () => {
  let userService: UserService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepository = createMockUserRepository();
    userService = new UserService(mockRepository);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = '123';
      const expectedUser = createMockUser({ id: userId });
      mockRepository.findById.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.findById(userId);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should return null when user not found', async () => {
      // Arrange
      const userId = '999';
      mockRepository.findById.mockResolvedValue(null);

      // Act
      const result = await userService.findById(userId);

      // Assert
      expect(result).toBeNull();
    });

    it('should throw error for invalid id', async () => {
      // Arrange
      const invalidId = '';

      // Act & Assert
      await expect(userService.findById(invalidId)).rejects.toThrow(
        ValidationError
      );
    });
  });
});
```

### **2. Test Coverage Requirements**

- **Unit tests**: 90%+ line coverage
- **Integration tests**: 80%+ line coverage
- **E2E tests**: Critical user flows only
- **Edge cases**: All boundary conditions
- **Error scenarios**: All error paths

### **3. Mock Strategy**

```typescript
// ✅ Proper mocking
const createMockContext = (overrides: Partial<Context> = {}): Context => ({
  req: {} as NextRushRequest,
  res: {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
  } as unknown as NextRushResponse,
  body: {},
  method: 'GET',
  path: '/test',
  headers: {},
  query: {},
  params: {},
  id: 'test-id',
  state: {},
  startTime: Date.now(),
  ip: '127.0.0.1',
  secure: false,
  protocol: 'http',
  hostname: 'localhost',
  host: 'localhost:3000',
  origin: 'http://localhost:3000',
  href: 'http://localhost:3000/test',
  search: '',
  searchParams: new URLSearchParams(),
  status: 200,
  responseHeaders: {},
  ...overrides,
});
```

---

## 🚀 **Performance Guidelines**

### **1. Memory Management**

```typescript
// ✅ Proper memory management
class RequestContextPool {
  private pool: Context[] = [];
  private maxSize = 100;

  acquire(): Context {
    return this.pool.pop() ?? this.createContext();
  }

  release(ctx: Context): void {
    if (this.pool.length < this.maxSize) {
      this.resetContext(ctx);
      this.pool.push(ctx);
    }
  }

  private resetContext(ctx: Context): void {
    ctx.body = undefined;
    ctx.state = {};
    ctx.params = {};
  }
}
```

### **2. Async/Await Best Practices**

```typescript
// ✅ Proper async handling
async function handleRequest(ctx: Context): Promise<void> {
  try {
    const user = await userService.findById(ctx.params.id);

    if (!user) {
      ctx.res.status(404).json({ error: 'User not found' });
      return;
    }

    ctx.res.json(user);
  } catch (error) {
    ctx.logger?.error('Failed to handle request', { error });
    ctx.res.status(500).json({ error: 'Internal server error' });
  }
}

// ❌ Avoid blocking operations
function badHandleRequest(ctx: Context): void {
  const user = userService.findByIdSync(ctx.params.id); // Blocking!
  ctx.res.json(user);
}
```

### **3. Efficient Data Structures**

```typescript
// ✅ Use appropriate data structures
class RouteMatcher {
  private routes = new Map<string, RouteHandler>();
  private paramRoutes = new Map<string, RouteHandler>();

  addRoute(path: string, handler: RouteHandler): void {
    if (path.includes(':')) {
      this.paramRoutes.set(path, handler);
    } else {
      this.routes.set(path, handler);
    }
  }

  findRoute(path: string): RouteHandler | null {
    // Fast path for exact matches
    const exactMatch = this.routes.get(path);
    if (exactMatch) return exactMatch;

    // Slower path for parameterized routes
    return this.findParamRoute(path);
  }
}
```

---

## 🔒 **Security Guidelines**

### **1. Input Validation**

```typescript
// ✅ Always validate input
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().min(0).max(150).optional(),
});

async function createUser(ctx: Context): Promise<void> {
  try {
    const userData = CreateUserSchema.parse(ctx.body);
    const user = await userService.create(userData);
    ctx.res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      ctx.res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }
    throw error;
  }
}
```

### **2. Error Information**

```typescript
// ✅ Don't leak sensitive information
async function handleError(error: Error, ctx: Context): Promise<void> {
  // Log full error for debugging
  ctx.logger?.error('Request failed', {
    error: error.message,
    stack: error.stack,
    path: ctx.path,
    method: ctx.method,
  });

  // Send safe error to client
  if (error instanceof ValidationError) {
    ctx.res.status(400).json({ error: 'Invalid request data' });
  } else if (error instanceof AuthenticationError) {
    ctx.res.status(401).json({ error: 'Authentication required' });
  } else {
    ctx.res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

## 📚 **Documentation Guidelines**

### **1. JSDoc Comments**

````typescript
/**
 * Creates a new user in the system
 *
 * @param userData - User data to create
 * @param options - Creation options
 * @returns Promise<User> - Created user object
 * @throws ValidationError - If user data is invalid
 * @throws ConflictError - If user already exists
 * @throws DatabaseError - If database operation fails
 *
 * @example
 * ```typescript
 * const user = await createUser({
 *   name: 'John Doe',
 *   email: 'john@example.com'
 * });
 * ```
 */
async function createUser(
  userData: CreateUserDto,
  options?: CreateUserOptions
): Promise<User> {
  // Implementation
}
````

### **2. README Files**

````markdown
# User Service

Handles user-related operations including creation, retrieval, and updates.

## Usage

```typescript
import { UserService } from '@/services/user';

const userService = new UserService(userRepository);

// Create a user
const user = await userService.create({
  name: 'John Doe',
  email: 'john@example.com',
});

// Find a user
const user = await userService.findById('123');
```
````

## API

### `create(userData: CreateUserDto): Promise<User>`

Creates a new user in the system.

**Parameters:**

- `userData` - User data to create

**Returns:**

- Promise<User> - Created user object

**Throws:**

- ValidationError - If user data is invalid
- ConflictError - If user already exists

````

---

## 🔄 **Migration Guidelines**

### **1. From v1 to v2**
```typescript
// v1 Style
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

// v2 Style
app.get('/users', async (ctx) => {
  ctx.res.json({ users: [] });
  // or
  ctx.body = { users: [] };
});
````

### **2. Plugin Migration**

```typescript
// v1: Everything was a plugin
const routerPlugin = new RouterPlugin();
routerPlugin.install(app);

// v2: Core features are built-in
app.get('/users', handler); // Built-in routing
app.use(cors()); // Built-in middleware

// Only advanced features are plugins
const loggerPlugin = new LoggerPlugin();
loggerPlugin.install(app);
```

---

## 🎯 **Quality Checklist**

### **Before Committing**

- [ ] All tests pass
- [ ] Code coverage >= 90%
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Documentation updated
- [ ] Performance tested
- [ ] Security reviewed

### **Code Review Checklist**

- [ ] Follows SOLID principles
- [ ] Proper error handling
- [ ] Type safety maintained
- [ ] Performance optimized
- [ ] Security considerations
- [ ] Test coverage adequate
- [ ] Documentation complete

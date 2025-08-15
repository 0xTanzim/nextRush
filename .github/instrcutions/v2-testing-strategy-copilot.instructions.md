# 🧪 NextRush v2 Testing Strategy

## 🎯 **Testing Philosophy**

### **1. Test-Driven Development (TDD)**

```typescript
// ✅ Write tests first, then implementation
describe('UserService', () => {
  it('should create user with valid data', async () => {
    // Arrange
    const userData = { name: 'John', email: 'john@example.com' };
    const mockRepository = createMockUserRepository();
    const userService = new UserService(mockRepository);

    // Act
    const result = await userService.create(userData);

    // Assert
    expect(result).toMatchObject(userData);
    expect(mockRepository.create).toHaveBeenCalledWith(userData);
  });
});
```

### **2. Comprehensive Coverage**

- **Unit Tests**: 99%+ line coverage
- **Integration Tests**: 99%+ line coverage
- **E2E Tests**: Critical user flows
- **Performance Tests**: Load testing
- **Security Tests**: Vulnerability scanning

---

## 📁 **Test Structure**

### **1. Test Organization**

```
src/tests/
├── unit/                    # Unit tests
│   ├── core/              # Core functionality tests
│   ├── middleware/        # Middleware tests
│   ├── plugins/           # Plugin tests
│   └── utils/             # Utility tests
├── integration/            # Integration tests
│   ├── app-integration.test.ts
│   ├── middleware-integration.test.ts
│   └── plugin-integration.test.ts
├── e2e/                   # End-to-end tests
│   ├── api-e2e.test.ts
│   └── performance-e2e.test.ts
└── fixtures/              # Test data and mocks
    ├── mock-context.ts
    ├── mock-request.ts
    └── test-data.ts
```

### **2. Test File Naming**

```typescript
// ✅ Consistent naming
user.service.test.ts        # Unit test for UserService
user.controller.test.ts     # Unit test for UserController
user.integration.test.ts    # Integration test for user features
user.e2e.test.ts          # E2E test for user flows
```

---

## 🔧 **Testing Tools & Configuration**

### **1. Test Runner Setup**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

### **2. Test Utilities**

```typescript
// src/tests/fixtures/mock-context.ts
import type { Context } from '@/types/context';
import type { NextRushRequest, NextRushResponse } from '@/types/http';

export const createMockContext = (
  overrides: Partial<Context> = {}
): Context => ({
  req: {
    method: 'GET',
    url: '/test',
    headers: {},
    body: {},
  } as NextRushRequest,
  res: {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
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

## 🧪 **Unit Testing**

### **1. Service Layer Testing**

```typescript
// src/tests/unit/services/user.service.test.ts
import { describe, it, expect, beforeEach, jest } from 'vitest';
import { UserService } from '@/services/user';
import { createMockUserRepository } from '@/tests/fixtures/mock-repository';
import { ValidationError, ConflictError } from '@/errors/custom-errors';

describe('UserService', () => {
  let userService: UserService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepository = createMockUserRepository();
    userService = new UserService(mockRepository);
  });

  describe('create', () => {
    it('should create user with valid data', async () => {
      // Arrange
      const userData = { name: 'John', email: 'john@example.com' };
      const expectedUser = { id: '123', ...userData, createdAt: new Date() };
      mockRepository.create.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.create(userData);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockRepository.create).toHaveBeenCalledWith(userData);
    });

    it('should throw ValidationError for invalid data', async () => {
      // Arrange
      const invalidData = { name: '', email: 'invalid-email' };

      // Act & Assert
      await expect(userService.create(invalidData)).rejects.toThrow(
        ValidationError
      );
    });
  });
});
```

### **2. Middleware Testing**

```typescript
// src/tests/unit/middleware/cors.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { cors } from '@/core/middleware/cors';
import { createMockContext } from '@/tests/fixtures/mock-context';

describe('CORS Middleware', () => {
  let ctx: Context;
  let next: jest.MockedFunction<() => Promise<void>>;

  beforeEach(() => {
    ctx = createMockContext();
    next = jest.fn().mockResolvedValue(undefined);
  });

  it('should add CORS headers', async () => {
    // Arrange
    const corsMiddleware = cors();

    // Act
    await corsMiddleware(ctx, next);

    // Assert
    expect(ctx.res.set).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      '*'
    );
    expect(next).toHaveBeenCalled();
  });
});
```

---

## 🔗 **Integration Testing**

### **1. Application Integration**

```typescript
// src/tests/integration/app-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '@/core/app/application';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';

describe('Application Integration', () => {
  let app: Application;
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  beforeAll(async () => {
    app = createApp();

    // Setup routes
    app.get('/users', async (ctx) => {
      ctx.res.json({ users: [] });
    });

    // Start server
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;
  });

  afterAll(async () => {
    await app.shutdown();
    server.close();
  });

  it('should handle GET requests', async () => {
    // Act
    const response = await fetch(`${baseUrl}/users`);

    // Assert
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ users: [] });
  });
});
```

---

## 🌐 **End-to-End Testing**

### **1. API E2E Tests**

```typescript
// src/tests/e2e/api-e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '@/core/app/application';

describe('API End-to-End', () => {
  let app: Application;
  let baseUrl: string;

  beforeAll(async () => {
    app = createApp();

    // Setup complete API
    app.use(app.cors());
    app.use(app.helmet());
    app.use(app.json());

    app.get('/api/users', async (ctx) => {
      ctx.res.json({ users: [] });
    });

    const server = app.listen(0);
    baseUrl = `http://localhost:${(server.address() as any).port}`;
  });

  it('should handle complete user CRUD flow', async () => {
    // Create user
    const createResponse = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
    });
    expect(createResponse.status).toBe(201);
  });
});
```

---

## 📊 **Test Coverage Requirements**

### **1. Coverage Thresholds**

```json
{
  "coverage": {
    "global": {
      "branches": 80,
      "functions": 90,
      "lines": 90,
      "statements": 90
    },
    "core": {
      "branches": 95,
      "functions": 95,
      "lines": 95,
      "statements": 95
    }
  }
}
```

---

## 🎯 **Test Best Practices**

### **1. Test Organization**

- ✅ Group related tests in describe blocks
- ✅ Use descriptive test names
- ✅ Follow AAA pattern (Arrange, Act, Assert)
- ✅ Keep tests independent and isolated
- ✅ Use beforeEach/afterEach for setup/cleanup

### **2. Mock Strategy**

- ✅ Mock external dependencies
- ✅ Use realistic test data
- ✅ Verify mock interactions
- ✅ Reset mocks between tests

### **3. Error Testing**

- ✅ Test all error scenarios
- ✅ Verify error messages
- ✅ Test error handling middleware
- ✅ Test boundary conditions

---

## 📋 **Test Checklist**

### **Before Running Tests**

- [ ] All dependencies installed
- [ ] Environment variables set
- [ ] Database/test data prepared
- [ ] Mock services configured

### **During Test Execution**

- [ ] All tests pass
- [ ] Coverage meets thresholds
- [ ] No memory leaks
- [ ] Performance benchmarks met

### **After Test Execution**

- [ ] Coverage report generated
- [ ] Performance report created
- [ ] Failed tests documented
- [ ] Test results archived

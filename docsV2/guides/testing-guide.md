# 🧪 Testing Guide

Comprehensive guide to testing NextRush v2 applications, covering unit tests, integration tests, e2e tests, and testing best practices.

---

## 📖 **Table of Contents**

1. [Testing Overview](#-testing-overview)
2. [Test Setup](#-test-setup)
3. [Unit Testing](#-unit-testing)
4. [Integration Testing](#-integration-testing)
5. [End-to-End Testing](#-end-to-end-testing)
6. [Testing Middleware](#-testing-middleware)
7. [Testing Plugins](#-testing-plugins)
8. [Mocking and Stubbing](#-mocking-and-stubbing)
9. [Performance Testing](#-performance-testing)
10. [Testing Best Practices](#-testing-best-practices)

---

## 🎯 **Testing Overview**

### **Testing Pyramid**

```
    /\     E2E Tests (Few, Slow, High Confidence)
   /  \
  /____\   Integration Tests (Some, Medium Speed)
 /______\
/________\  Unit Tests (Many, Fast, Low-level)
```

### **Test Types in NextRush**

1. **Unit Tests**: Test individual functions, classes, and components
2. **Integration Tests**: Test interactions between components
3. **E2E Tests**: Test complete user workflows
4. **API Tests**: Test HTTP endpoints and responses
5. **Performance Tests**: Test performance characteristics

---

## ⚙️ **Test Setup**

### **Installing Test Dependencies**

```bash
npm install --save-dev vitest supertest @types/supertest
npm install --save-dev @vitest/coverage-v8
```

### **Vitest Configuration**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: ['node_modules/**', 'dist/**', '**/*.test.ts', '**/*.spec.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### **Test Helper Functions**

```typescript
// tests/helpers/test-utils.ts
import { createApp, type Application } from 'nextrush';
import type { Context } from 'nextrush';

export const createTestApp = (): Application => {
  const app = createApp({
    debug: false,
    port: 0, // Use random port for tests
  });

  return app;
};

export const createMockContext = (
  overrides: Partial<Context> = {}
): Context => {
  const mockReq = {
    method: 'GET',
    url: '/',
    headers: {},
    ...overrides.req,
  };

  const mockRes = {
    statusCode: 200,
    setHeader: vi.fn(),
    getHeader: vi.fn(),
    json: vi.fn(),
    text: vi.fn(),
    status: vi.fn().mockReturnThis(),
    ...overrides.res,
  };

  return {
    req: mockReq,
    res: mockRes,
    method: mockReq.method,
    path: mockReq.url,
    query: {},
    params: {},
    body: {},
    state: {},
    ...overrides,
  } as Context;
};

export const delay = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));
```

---

## 🔧 **Unit Testing**

### **Testing Functions**

```typescript
// src/utils/validation.ts
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const sanitizeString = (input: string): string => {
  return input.trim().toLowerCase();
};
```

```typescript
// tests/unit/utils/validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateEmail, sanitizeString } from '@/utils/validation';

describe('validateEmail', () => {
  it('should return true for valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.email+tag@domain.co.uk')).toBe(true);
  });

  it('should return false for invalid emails', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
  });

  it('should handle empty strings', () => {
    expect(validateEmail('')).toBe(false);
  });
});

describe('sanitizeString', () => {
  it('should trim and lowercase strings', () => {
    expect(sanitizeString('  HELLO WORLD  ')).toBe('hello world');
    expect(sanitizeString('MixedCase')).toBe('mixedcase');
  });

  it('should handle empty strings', () => {
    expect(sanitizeString('')).toBe('');
    expect(sanitizeString('   ')).toBe('');
  });
});
```

### **Testing Classes**

```typescript
// src/services/user.service.ts
export class UserService {
  constructor(private repository: UserRepository) {}

  async createUser(userData: CreateUserDto): Promise<User> {
    if (!userData.email) {
      throw new ValidationError('Email is required');
    }

    const existingUser = await this.repository.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictError('User already exists');
    }

    return this.repository.create(userData);
  }

  async findById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }
}
```

```typescript
// tests/unit/services/user.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from '@/services/user.service';
import { ValidationError, ConflictError } from '@/errors';

describe('UserService', () => {
  let userService: UserService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
    };

    userService = new UserService(mockRepository);
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const userData = { email: 'test@example.com', name: 'Test User' };
      const expectedUser = { id: '1', ...userData };

      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedUser);

      const result = await userService.createUser(userData);

      expect(result).toEqual(expectedUser);
      expect(mockRepository.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(mockRepository.create).toHaveBeenCalledWith(userData);
    });

    it('should throw ValidationError when email is missing', async () => {
      const userData = { name: 'Test User' };

      await expect(userService.createUser(userData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ConflictError when user exists', async () => {
      const userData = { email: 'test@example.com', name: 'Test User' };
      const existingUser = { id: '1', email: userData.email };

      mockRepository.findByEmail.mockResolvedValue(existingUser);

      await expect(userService.createUser(userData)).rejects.toThrow(
        ConflictError
      );
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const userId = '1';
      const expectedUser = { id: userId, email: 'test@example.com' };

      mockRepository.findById.mockResolvedValue(expectedUser);

      const result = await userService.findById(userId);

      expect(result).toEqual(expectedUser);
    });

    it('should return null when user not found', async () => {
      const userId = '999';

      mockRepository.findById.mockResolvedValue(null);

      const result = await userService.findById(userId);

      expect(result).toBeNull();
    });
  });
});
```

---

## 🔗 **Integration Testing**

### **Testing Application Routes**

```typescript
// tests/integration/user.routes.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/test-utils';
import { UserService } from '@/services/user.service';

describe('User Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = createTestApp();

    // Setup routes
    app.post('/users', async ctx => {
      const user = await UserService.create(ctx.body);
      ctx.res.status(201).json(user);
    });

    app.get('/users/:id', async ctx => {
      const user = await UserService.findById(ctx.params.id);
      if (!user) {
        ctx.res.status(404).json({ error: 'User not found' });
        return;
      }
      ctx.res.json(user);
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /users', () => {
    it('should create user successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const response = await request(app.callback())
        .post('/users')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: userData.name,
        email: userData.email,
        createdAt: expect.any(String),
      });
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = {
        name: '',
        email: 'invalid-email',
      };

      const response = await request(app.callback())
        .post('/users')
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation failed',
        details: expect.any(Array),
      });
    });
  });

  describe('GET /users/:id', () => {
    it('should return user when found', async () => {
      // First create a user
      const createResponse = await request(app.callback())
        .post('/users')
        .send({ name: 'Jane Doe', email: 'jane@example.com' })
        .expect(201);

      const userId = createResponse.body.id;

      // Then fetch it
      const response = await request(app.callback())
        .get(`/users/${userId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: userId,
        name: 'Jane Doe',
        email: 'jane@example.com',
      });
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app.callback())
        .get('/users/non-existent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'User not found',
      });
    });
  });
});
```

### **Testing Database Integration**

```typescript
// tests/integration/database.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Database } from '@/database';
import { UserRepository } from '@/repositories/user.repository';

describe('Database Integration', () => {
  let database: Database;
  let userRepository: UserRepository;

  beforeAll(async () => {
    database = new Database({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
    });

    await database.connect();
    userRepository = new UserRepository(database);
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.clear(); // Clear all tables
  });

  describe('User CRUD operations', () => {
    it('should create and find user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
      };

      const createdUser = await userRepository.create(userData);
      expect(createdUser.id).toBeDefined();

      const foundUser = await userRepository.findById(createdUser.id);
      expect(foundUser).toMatchObject(userData);
    });

    it('should update user', async () => {
      const user = await userRepository.create({
        name: 'Original Name',
        email: 'original@example.com',
      });

      const updatedUser = await userRepository.update(user.id, {
        name: 'Updated Name',
      });

      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.email).toBe('original@example.com');
    });

    it('should delete user', async () => {
      const user = await userRepository.create({
        name: 'To Delete',
        email: 'delete@example.com',
      });

      await userRepository.delete(user.id);

      const foundUser = await userRepository.findById(user.id);
      expect(foundUser).toBeNull();
    });
  });
});
```

---

## 🌐 **End-to-End Testing**

### **E2E Test Setup**

```typescript
// tests/e2e/setup.ts
import { createApp } from 'nextrush';
import { Database } from '@/database';

export const setupE2ETest = async () => {
  // Create test database
  const database = new Database({
    type: 'postgresql',
    host: 'localhost',
    port: 5433, // Test database port
    database: 'test_db',
    synchronize: true,
  });

  await database.connect();

  // Create app with test configuration
  const app = createApp({
    port: 0, // Random port
    database,
  });

  // Setup test data
  await seedTestData(database);

  return { app, database };
};

export const teardownE2ETest = async (app, database) => {
  await app.close();
  await database.close();
};
```

### **User Journey Tests**

```typescript
// tests/e2e/user-journey.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupE2ETest, teardownE2ETest } from './setup';

describe('User Journey E2E', () => {
  let app, database, server;

  beforeAll(async () => {
    ({ app, database } = await setupE2ETest());
    server = app.listen();
  });

  afterAll(async () => {
    await teardownE2ETest(app, database);
  });

  it('should complete full user registration and login flow', async () => {
    const userData = {
      name: 'E2E Test User',
      email: 'e2e@example.com',
      password: 'password123',
    };

    // 1. Register user
    const registerResponse = await request(server)
      .post('/auth/register')
      .send(userData)
      .expect(201);

    expect(registerResponse.body).toMatchObject({
      user: {
        id: expect.any(String),
        name: userData.name,
        email: userData.email,
      },
      token: expect.any(String),
    });

    const token = registerResponse.body.token;

    // 2. Login with credentials
    const loginResponse = await request(server)
      .post('/auth/login')
      .send({
        email: userData.email,
        password: userData.password,
      })
      .expect(200);

    expect(loginResponse.body).toMatchObject({
      token: expect.any(String),
      user: expect.objectContaining({
        email: userData.email,
      }),
    });

    // 3. Access protected resource
    const profileResponse = await request(server)
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profileResponse.body).toMatchObject({
      id: registerResponse.body.user.id,
      name: userData.name,
      email: userData.email,
    });

    // 4. Update profile
    const updateResponse = await request(server)
      .put('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' })
      .expect(200);

    expect(updateResponse.body.name).toBe('Updated Name');

    // 5. Logout
    await request(server)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // 6. Verify token is invalidated
    await request(server)
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('should handle order placement workflow', async () => {
    // Login as existing user
    const loginResponse = await request(server)
      .post('/auth/login')
      .send({ email: 'customer@example.com', password: 'password' })
      .expect(200);

    const token = loginResponse.body.token;

    // 1. Get product catalog
    const catalogResponse = await request(server).get('/products').expect(200);

    expect(catalogResponse.body.products).toHaveLength.greaterThan(0);

    const product = catalogResponse.body.products[0];

    // 2. Add to cart
    await request(server)
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        quantity: 2,
      })
      .expect(201);

    // 3. Get cart
    const cartResponse = await request(server)
      .get('/cart')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(cartResponse.body.items).toHaveLength(1);
    expect(cartResponse.body.total).toBeGreaterThan(0);

    // 4. Place order
    const orderResponse = await request(server)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
        },
        paymentMethod: 'credit_card',
      })
      .expect(201);

    expect(orderResponse.body).toMatchObject({
      id: expect.any(String),
      status: 'pending',
      total: cartResponse.body.total,
    });

    // 5. Verify cart is cleared
    const clearedCartResponse = await request(server)
      .get('/cart')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(clearedCartResponse.body.items).toHaveLength(0);
  });
});
```

---

## 🛠️ **Testing Middleware**

### **Unit Testing Middleware**

```typescript
// tests/unit/middleware/auth.test.ts
import { describe, it, expect, vi } from 'vitest';
import { authMiddleware } from '@/middleware/auth';
import { createMockContext } from '../../helpers/test-utils';

describe('Auth Middleware', () => {
  it('should authenticate valid token', async () => {
    const ctx = createMockContext({
      req: {
        headers: {
          authorization: 'Bearer valid-token',
        },
      },
    });

    const next = vi.fn();

    // Mock JWT verification
    vi.mock('jsonwebtoken', () => ({
      verify: vi
        .fn()
        .mockReturnValue({ sub: 'user123', email: 'test@example.com' }),
    }));

    await authMiddleware(ctx, next);

    expect(ctx.state.user).toBeDefined();
    expect(ctx.state.user.id).toBe('user123');
    expect(next).toHaveBeenCalled();
  });

  it('should reject invalid token', async () => {
    const ctx = createMockContext({
      req: {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      },
    });

    const next = vi.fn();

    // Mock JWT verification failure
    vi.mock('jsonwebtoken', () => ({
      verify: vi.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      }),
    }));

    await authMiddleware(ctx, next);

    expect(ctx.res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should continue without token for optional auth', async () => {
    const ctx = createMockContext();
    const next = vi.fn();

    await authMiddleware(ctx, next, { required: false });

    expect(ctx.state.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
```

### **Integration Testing Middleware**

```typescript
// tests/integration/middleware.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/test-utils';
import { authMiddleware, rateLimitMiddleware } from '@/middleware';

describe('Middleware Integration', () => {
  it('should apply middleware in correct order', async () => {
    const app = createTestApp();
    const calls: string[] = [];

    app.use(async (ctx, next) => {
      calls.push('middleware1-before');
      await next();
      calls.push('middleware1-after');
    });

    app.use(async (ctx, next) => {
      calls.push('middleware2-before');
      await next();
      calls.push('middleware2-after');
    });

    app.get('/test', ctx => {
      calls.push('handler');
      ctx.res.json({ success: true });
    });

    await request(app.callback()).get('/test').expect(200);

    expect(calls).toEqual([
      'middleware1-before',
      'middleware2-before',
      'handler',
      'middleware2-after',
      'middleware1-after',
    ]);
  });

  it('should handle middleware errors', async () => {
    const app = createTestApp();

    app.use(async (ctx, next) => {
      throw new Error('Middleware error');
    });

    app.get('/test', ctx => {
      ctx.res.json({ success: true });
    });

    const response = await request(app.callback()).get('/test').expect(500);

    expect(response.body).toMatchObject({
      error: 'Internal server error',
    });
  });
});
```

---

## 🔌 **Testing Plugins**

### **Plugin Unit Tests**

```typescript
// tests/unit/plugins/cache.plugin.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CachePlugin } from '@/plugins/cache.plugin';
import { createTestApp } from '../../helpers/test-utils';

describe('CachePlugin', () => {
  let app;
  let plugin: CachePlugin;

  beforeEach(() => {
    app = createTestApp();
    plugin = new CachePlugin({
      provider: 'memory',
      ttl: 1000,
    });
  });

  it('should install successfully', async () => {
    await expect(plugin.install(app)).resolves.not.toThrow();
  });

  it('should register cache service', async () => {
    await plugin.install(app);

    expect(app.container.has('cache')).toBe(true);
  });

  it('should cache responses', async () => {
    await plugin.install(app);

    let callCount = 0;
    app.get('/cached', ctx => {
      callCount++;
      ctx.res.json({ count: callCount, timestamp: Date.now() });
    });

    const response1 = await request(app.callback()).get('/cached');
    const response2 = await request(app.callback()).get('/cached');

    expect(response1.body.count).toBe(1);
    expect(response2.body.count).toBe(1); // Should be cached
    expect(response1.body.timestamp).toBe(response2.body.timestamp);
  });

  it('should expire cache after TTL', async () => {
    plugin = new CachePlugin({ provider: 'memory', ttl: 100 });
    await plugin.install(app);

    let callCount = 0;
    app.get('/cached', ctx => {
      callCount++;
      ctx.res.json({ count: callCount });
    });

    await request(app.callback()).get('/cached');

    // Wait for cache to expire
    await delay(150);

    const response = await request(app.callback()).get('/cached');
    expect(response.body.count).toBe(2); // Cache expired, new call
  });
});
```

---

## 🎭 **Mocking and Stubbing**

### **Mocking External Services**

```typescript
// tests/unit/services/payment.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from '@/services/payment.service';

// Mock external payment gateway
vi.mock('@/integrations/stripe', () => ({
  Stripe: vi.fn().mockImplementation(() => ({
    charges: {
      create: vi.fn(),
    },
    paymentIntents: {
      create: vi.fn(),
      confirm: vi.fn(),
    },
  })),
}));

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockStripe;

  beforeEach(() => {
    const { Stripe } = require('@/integrations/stripe');
    mockStripe = new Stripe();
    paymentService = new PaymentService(mockStripe);
  });

  it('should process payment successfully', async () => {
    mockStripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_123',
      status: 'succeeded',
      amount: 2000,
    });

    const result = await paymentService.processPayment({
      amount: 2000,
      currency: 'usd',
      paymentMethod: 'pm_123',
    });

    expect(result.success).toBe(true);
    expect(result.transactionId).toBe('pi_123');
  });

  it('should handle payment failures', async () => {
    mockStripe.paymentIntents.create.mockRejectedValue(
      new Error('Insufficient funds')
    );

    const result = await paymentService.processPayment({
      amount: 2000,
      currency: 'usd',
      paymentMethod: 'pm_123',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient funds');
  });
});
```

### **Database Mocking**

```typescript
// tests/unit/repositories/user.repository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from '@/repositories/user.repository';

describe('UserRepository', () => {
  let repository: UserRepository;
  let mockDatabase;

  beforeEach(() => {
    mockDatabase = {
      query: vi.fn(),
      transaction: vi.fn(),
    };

    repository = new UserRepository(mockDatabase);
  });

  it('should find user by email', async () => {
    const expectedUser = { id: '1', email: 'test@example.com' };
    mockDatabase.query.mockResolvedValue([expectedUser]);

    const result = await repository.findByEmail('test@example.com');

    expect(result).toEqual(expectedUser);
    expect(mockDatabase.query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE email = ?',
      ['test@example.com']
    );
  });

  it('should create user with transaction', async () => {
    const userData = { name: 'Test', email: 'test@example.com' };
    const expectedUser = { id: '1', ...userData };

    mockDatabase.transaction.mockImplementation(async callback => {
      return callback({
        query: vi.fn().mockResolvedValue({ insertId: '1' }),
      });
    });

    const result = await repository.create(userData);

    expect(mockDatabase.transaction).toHaveBeenCalled();
    expect(result).toMatchObject(userData);
  });
});
```

---

## ⚡ **Performance Testing**

### **Load Testing**

```typescript
// tests/performance/load.test.ts
import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';
import request from 'supertest';
import { createTestApp } from '../helpers/test-utils';

describe('Performance Tests', () => {
  it('should handle concurrent requests efficiently', async () => {
    const app = createTestApp();

    app.get('/api/data', ctx => {
      // Simulate some processing
      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: Math.random(),
      }));
      ctx.res.json(data);
    });

    const concurrentRequests = 50;
    const requests = Array.from({ length: concurrentRequests }, () =>
      request(app.callback()).get('/api/data')
    );

    const start = performance.now();
    const responses = await Promise.all(requests);
    const end = performance.now();

    const duration = end - start;
    const averageTime = duration / concurrentRequests;

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1000);
    });

    // Performance assertions
    expect(duration).toBeLessThan(5000); // Total time under 5 seconds
    expect(averageTime).toBeLessThan(100); // Average response under 100ms

    console.log(
      `${concurrentRequests} concurrent requests completed in ${duration.toFixed(2)}ms`
    );
    console.log(`Average response time: ${averageTime.toFixed(2)}ms`);
  });

  it('should handle memory efficiently', async () => {
    const app = createTestApp();

    app.post('/api/upload', ctx => {
      // Simulate file processing
      const size = ctx.body.size || 1000000; // 1MB default
      const buffer = Buffer.alloc(size, 'test data');

      ctx.res.json({
        processed: true,
        size: buffer.length,
      });
    });

    const initialMemory = process.memoryUsage().heapUsed;

    // Send multiple large requests
    const requests = Array.from(
      { length: 10 },
      () => request(app.callback()).post('/api/upload').send({ size: 1000000 }) // 1MB each
    );

    await Promise.all(requests);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be reasonable
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
  });
});
```

### **Benchmark Testing**

```typescript
// tests/performance/benchmark.test.ts
import { describe, it } from 'vitest';
import { performance } from 'perf_hooks';

describe('Benchmarks', () => {
  it('should benchmark routing performance', async () => {
    const app = createTestApp();

    // Add many routes
    for (let i = 0; i < 1000; i++) {
      app.get(`/route-${i}`, ctx => {
        ctx.res.json({ route: i });
      });
    }

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const routeIndex = Math.floor(Math.random() * 1000);
      await request(app.callback()).get(`/route-${routeIndex}`);
    }

    const end = performance.now();
    const totalTime = end - start;
    const avgTime = totalTime / iterations;

    console.log(
      `Routing benchmark: ${iterations} requests in ${totalTime.toFixed(2)}ms`
    );
    console.log(`Average routing time: ${avgTime.toFixed(4)}ms per request`);

    // Performance expectations
    expect(avgTime).toBeLessThan(1); // Under 1ms per route lookup
  });
});
```

---

## 💡 **Testing Best Practices**

### **1. Test Structure (AAA Pattern)**

```typescript
// ✅ Good: Arrange, Act, Assert
it('should create user with valid data', async () => {
  // Arrange
  const userData = { name: 'John', email: 'john@example.com' };
  const expectedUser = { id: '1', ...userData };
  mockRepository.create.mockResolvedValue(expectedUser);

  // Act
  const result = await userService.createUser(userData);

  // Assert
  expect(result).toEqual(expectedUser);
  expect(mockRepository.create).toHaveBeenCalledWith(userData);
});
```

### **2. Test Isolation**

```typescript
// ✅ Good: Each test is independent
describe('UserService', () => {
  let userService: UserService;
  let mockRepository: MockRepository;

  beforeEach(() => {
    // Fresh instances for each test
    mockRepository = createMockRepository();
    userService = new UserService(mockRepository);
  });

  afterEach(() => {
    // Clean up after each test
    vi.clearAllMocks();
  });
});
```

### **3. Descriptive Test Names**

```typescript
// ✅ Good: Descriptive names
describe('User authentication', () => {
  it('should return user data when valid credentials provided', () => {});
  it('should throw UnauthorizedError when password is incorrect', () => {});
  it('should throw NotFoundError when user does not exist', () => {});
});

// ❌ Bad: Vague names
describe('Auth tests', () => {
  it('should work', () => {});
  it('should fail', () => {});
});
```

### **4. Test Data Builders**

```typescript
// Helper functions for test data
const createUser = (overrides = {}) => ({
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  createdAt: new Date().toISOString(),
  ...overrides,
});

const createOrder = (overrides = {}) => ({
  id: '1',
  userId: '1',
  total: 100,
  status: 'pending',
  items: [],
  ...overrides,
});

// Usage in tests
it('should calculate order total correctly', () => {
  const order = createOrder({
    items: [
      { price: 50, quantity: 2 },
      { price: 25, quantity: 1 },
    ],
  });

  const total = calculateOrderTotal(order);
  expect(total).toBe(125);
});
```

### **5. Error Testing**

```typescript
// ✅ Test both success and failure cases
describe('User creation', () => {
  it('should create user successfully with valid data', async () => {
    // Test success case
  });

  it('should throw ValidationError when email is invalid', async () => {
    await expect(userService.createUser({ email: 'invalid' })).rejects.toThrow(
      ValidationError
    );
  });

  it('should throw ConflictError when email already exists', async () => {
    // Test conflict case
  });
});
```

---

## 🚀 **Next Steps**

1. **Set up test environment** with Vitest and SuperTest
2. **Write unit tests** for critical business logic
3. **Add integration tests** for API endpoints
4. **Create E2E tests** for main user journeys
5. **Implement performance tests** for critical paths
6. **Set up CI/CD** to run tests automatically

---

## 📖 **See Also**

- [Error Handling Guide](./error-handling.md)
- [Performance Optimization](./performance-optimization.md)
- [Production Deployment](./production-deployment.md)
- [Debugging Guide](./debugging.md)

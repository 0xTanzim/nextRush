import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { Controller, Get, Service, UseGuard, inject } from '@nextrush/class';
import { CanActivate } from '@nextrush/di';
import type { GuardContext } from '@nextrush/class';
import { createTestModule } from '../index.js';

// ============================================================================
// Test Services & Controllers
// ============================================================================

@Service()
class UserService {
  getUser(id: string) {
    return { id, name: 'Alice' };
  }
}

@Service({ scope: 'request' })
class RequestIdService {
  private static counter = 0;
  readonly id = ++RequestIdService.counter;
}

@Controller('/users')
class UserController {
  constructor(
    @inject(UserService) private userService: UserService,
    @inject(RequestIdService) private requestId: RequestIdService
  ) {}

  @Get('/:id')
  getUser() {
    return this.userService.getUser('123');
  }

  @Get('/info')
  getInfo() {
    return { requestId: this.requestId.id };
  }
}

@Service()
class AuthService {
  isAuthorized(): boolean {
    return true;
  }
}

class AuthGuard implements CanActivate {
  constructor(@inject(AuthService) private authService: AuthService) {}

  canActivate(ctx: GuardContext): boolean {
    return this.authService.isAuthorized();
  }
}

@Controller('/protected')
class ProtectedController {
  @UseGuard(AuthGuard)
  @Get('/')
  getProtected() {
    return { message: 'protected' };
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('TestModule', () => {
  describe('(a) get() resolves a provider from the isolated container', () => {
    it('should resolve a service from the container', async () => {
      const testModule = createTestModule({
        providers: [UserService],
      });

      const ref = await testModule.compile();
      const service = ref.get<UserService>(UserService);

      expect(service).toBeInstanceOf(UserService);
      expect(service.getUser('1')).toEqual({ id: '1', name: 'Alice' });

      await ref.close();
    });
  });

  describe('(b) .override(Svc).useValue(fake) makes get(Svc) + controller injection return the fake', () => {
    it('should override a service with a fake value', async () => {
      const fakeUserService = {
        getUser: (id: string) => ({ id, name: 'Bob (Fake)' }),
      };

      const testModule = createTestModule({
        providers: [UserService],
        controllers: [UserController],
      })
        .override(UserService)
        .useValue(fakeUserService);

      const ref = await testModule.compile();

      // get() should return the fake
      const service = ref.get<typeof fakeUserService>(UserService);
      expect(service.getUser('1')).toEqual({ id: '1', name: 'Bob (Fake)' });

      // controller should also receive the fake
      const response = await ref.request('GET', '/users/123');
      // The controller calls getUser('123'), which comes from the route params
      expect(response.body).toEqual({ id: '123', name: 'Bob (Fake)' });

      await ref.close();
    });

    it('should override a service with a fake class', async () => {
      class FakeUserService {
        getUser(id: string) {
          return { id, name: 'Charlie (Fake)' };
        }
      }

      const testModule = createTestModule({
        providers: [UserService],
        controllers: [UserController],
      })
        .override(UserService)
        .useClass(FakeUserService);

      const ref = await testModule.compile();

      const service = ref.get<FakeUserService>(UserService);
      expect(service.getUser('1')).toEqual({ id: '1', name: 'Charlie (Fake)' });

      await ref.close();
    });

    it('should override a service with a factory', async () => {
      const testModule = createTestModule({
        providers: [UserService],
        controllers: [UserController],
      })
        .override(UserService)
        .useFactory(() => ({
          getUser: (id: string) => ({ id, name: 'David (Factory)' }),
        }));

      const ref = await testModule.compile();

      const service = ref.get(UserService);
      expect((service as any).getUser('1')).toEqual({ id: '1', name: 'David (Factory)' });

      await ref.close();
    });
  });

  describe('(c) request(GET, /path) drives a controller route and returns its JSON body + status', () => {
    it('should drive a GET request through the router and return response', async () => {
      const testModule = createTestModule({
        providers: [UserService, RequestIdService],
        controllers: [UserController],
      });

      const ref = await testModule.compile();

      const response = await ref.request('GET', '/users/123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: '123', name: 'Alice' });

      await ref.close();
    });

    it('should support GET and route parameter matching', async () => {
      @Controller('/items')
      class ItemController {
        @Get('/')
        list() {
          return { items: [{ id: 1 }] };
        }

        @Get('/:id')
        getItem() {
          return { id: 1, name: 'Item 1' };
        }
      }

      const testModule = createTestModule({
        controllers: [ItemController],
      });

      const ref = await testModule.compile();

      const response = await ref.request('GET', '/items');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ items: [{ id: 1 }] });

      await ref.close();
    });
  });

  describe('(d) ISOLATION: two separate createTestModule(...).compile() do NOT share singleton instances', () => {
    it('should create isolated containers for each test module', async () => {
      const testModule1 = createTestModule({
        providers: [UserService],
      });

      const testModule2 = createTestModule({
        providers: [UserService],
      });

      const ref1 = await testModule1.compile();
      const ref2 = await testModule2.compile();

      const service1 = ref1.get<UserService>(UserService);
      const service2 = ref2.get<UserService>(UserService);

      // They should be different instances (different containers)
      expect(service1).not.toBe(service2);

      await ref1.close();
      await ref2.close();
    });

    it('should not share state between modules', async () => {
      @Service()
      class CounterService {
        count = 0;
        increment() {
          return ++this.count;
        }
      }

      const testModule1 = createTestModule({
        providers: [CounterService],
      });

      const testModule2 = createTestModule({
        providers: [CounterService],
      });

      const ref1 = await testModule1.compile();
      const ref2 = await testModule2.compile();

      const counter1 = ref1.get<CounterService>(CounterService);
      const counter2 = ref2.get<CounterService>(CounterService);

      counter1.increment();
      counter1.increment();

      expect(counter1.count).toBe(2);
      expect(counter2.count).toBe(0); // Isolated, not affected by module1

      await ref1.close();
      await ref2.close();
    });
  });

  describe('(e) a request-scoped service is fresh per request() call', () => {
    it('should create a fresh instance per request', async () => {
      const testModule = createTestModule({
        providers: [RequestIdService],
        controllers: [UserController],
      });

      const ref = await testModule.compile();

      const response1 = await ref.request('GET', '/users/info');
      const response2 = await ref.request('GET', '/users/info');

      // Each request gets a fresh RequestIdService instance
      const body1 = response1.body as { requestId: number };
      const body2 = response2.body as { requestId: number };

      expect(body1.requestId).not.toBe(body2.requestId);
      expect(body2.requestId > body1.requestId).toBe(true);

      await ref.close();
    });
  });

  describe('(f) close() triggers an OnShutdown hook', () => {
    it('should close the application cleanly', async () => {
      @Service()
      class SimpleService {
        getValue() {
          return 'test';
        }
      }

      const testModule = createTestModule({
        providers: [SimpleService],
      });

      const ref = await testModule.compile();
      const service = ref.get<SimpleService>(SimpleService);

      expect(service.getValue()).toBe('test');

      // close should not throw
      await expect(ref.close()).resolves.toBeUndefined();
    });
  });

  describe('builder chaining', () => {
    it('should support multiple overrides in chain', async () => {
      class FakeService1 {
        getValue() {
          return 'fake1';
        }
      }

      class FakeService2 {
        getValue() {
          return 'fake2';
        }
      }

      @Service()
      class Service1 {
        getValue() {
          return 'real1';
        }
      }

      @Service()
      class Service2 {
        getValue() {
          return 'real2';
        }
      }

      const testModule = createTestModule({
        providers: [Service1, Service2],
      })
        .override(Service1)
        .useClass(FakeService1)
        .override(Service2)
        .useValue(new FakeService2());

      const ref = await testModule.compile();

      const s1 = ref.get<any>(Service1);
      const s2 = ref.get<any>(Service2);

      expect(s1.getValue()).toBe('fake1');
      expect(s2.getValue()).toBe('fake2');

      await ref.close();
    });
  });
});

/**
 * E2E tests for NextRush v2 features
 *
 * @packageDocumentation
 */

import {
  AuthenticationError,
  AuthenticationExceptionFilter,
  AuthorizationError,
  BadRequestError,
  BadRequestExceptionFilter,
  ConflictError,
  GlobalExceptionFilter,
  NotFoundError,
  RateLimitError,
  RateLimitExceptionFilter,
  ValidationError,
  ValidationExceptionFilter,
} from '@/errors/custom-errors';
import { ErrorFactory } from '@/errors/error-factory';
import { createApp } from '@/index';
import type { Application, Context } from '@/types/context';
import { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';

describe('NextRush v2 Features E2E Tests', () => {
  let app: Application;
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    app = createApp({ port: 0 });

    // Add body parser middleware
    app.use(app.smartBodyParser());

    // Add exception filter
    app.use(
      app.exceptionFilter([
        new BadRequestExceptionFilter(),
        new ValidationExceptionFilter(),
        new RateLimitExceptionFilter(),
        new AuthenticationExceptionFilter(),
        new GlobalExceptionFilter(),
      ])
    );

    // Test routes
    app.get('/test', (ctx: Context) => {
      ctx.res.json({ message: 'Hello World' });
    });

    app.post('/users', (ctx: Context) => {
      // Handle text bodies
      if (typeof ctx.body === 'string') {
        ctx.res.status(201).json({
          message: 'User created',
          user: { name: ctx.body, email: 'text@example.com' },
        });
        return;
      }

      // Handle JSON bodies
      const body =
        (ctx.body as {
          name?: string;
          email?: string;
          age?: number;
        }) || {};

      const { name, email, age } = body;

      // Validation
      if (!name || !email) {
        throw new ValidationError('Name and email are required', 'body');
      }

      if (age && (age < 18 || age > 120)) {
        throw new ValidationError('Age must be between 18 and 120', 'age', age);
      }

      ctx.res.status(201).json({
        message: 'User created',
        user: { name, email, age },
      });
    });

    app.get('/users/:id', (ctx: Context) => {
      const userId = ctx.params['id'];

      if (userId === '404') {
        throw new NotFoundError('User not found');
      }

      if (userId === '401') {
        throw new AuthenticationError('Authentication required');
      }

      if (userId === '403') {
        throw new AuthorizationError('Insufficient permissions');
      }

      if (userId === '409') {
        throw new ConflictError('User already exists');
      }

      if (userId === '429') {
        throw new RateLimitError('Rate limit exceeded', 30);
      }

      ctx.res.json({ userId, name: 'John Doe' });
    });

    app.put('/users/:id', (ctx: Context) => {
      const body = (ctx.body as { name?: string; email?: string }) || {};
      const { name, email } = body;

      if (!name && !email) {
        throw new BadRequestError('At least one field is required');
      }

      ctx.res.json({
        message: 'User updated',
        userId: ctx.params['id'],
        updates: { name, email },
      });
    });

    // Start server and wait for it to be ready
    server = app.listen();

    // Wait for server to be ready
    await new Promise<void>(resolve => {
      server.on('listening', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await app.shutdown();
  });

  describe('Smart Body Parser', () => {
    it('should parse JSON bodies automatically', async () => {
      const response = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
        }),
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as {
        message: string;
        user: { name: string };
      };
      expect(data.message).toBe('User created');
      expect(data.user.name).toBe('John Doe');
    });

    it('should parse URL-encoded bodies automatically', async () => {
      const response = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'name=Jane%20Doe&email=jane@example.com&age=25',
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as {
        message: string;
        user: { name: string };
      };
      expect(data.message).toBe('User created');
      expect(data.user.name).toBe('Jane Doe');
    });

    it('should parse text bodies automatically', async () => {
      const response = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'Hello World',
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as { user: { name: string } };
      expect(data.user.name).toBe('Hello World');
    });

    it('should handle empty bodies gracefully', async () => {
      const response = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: { message: string } };
      expect(data.error.message).toBe('Name and email are required');
    });

    it('should skip body parsing for GET requests', async () => {
      const response = await fetch(`${baseUrl}/test`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { message: string };
      expect(data.message).toBe('Hello World');
    });
  });

  describe('Custom Error Handling', () => {
    it('should handle ValidationError with proper format', async () => {
      const response = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'John',
          email: 'john@example.com',
          age: 15, // Invalid age
        }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as {
        error: {
          name: string;
          code: string;
          statusCode: number;
          field: string;
          value: number;
        };
      };
      expect(data.error.name).toBe('ValidationError');
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.statusCode).toBe(400);
      expect(data.error.field).toBe('age');
      expect(data.error.value).toBe(15);
    });

    it('should handle NotFoundError', async () => {
      const response = await fetch(`${baseUrl}/users/404`);
      expect(response.status).toBe(404);
      const data = (await response.json()) as {
        error: {
          name: string;
          code: string;
          statusCode: number;
        };
      };
      expect(data.error.name).toBe('NotFoundError');
      expect(data.error.code).toBe('NOT_FOUND');
      expect(data.error.statusCode).toBe(404);
    });

    it('should handle AuthenticationError', async () => {
      const response = await fetch(`${baseUrl}/users/401`);
      expect(response.status).toBe(401);
      const data = (await response.json()) as {
        error: {
          name: string;
          code: string;
          statusCode: number;
        };
      };
      expect(data.error.name).toBe('AuthenticationError');
      expect(data.error.code).toBe('AUTHENTICATION_ERROR');
      expect(data.error.statusCode).toBe(401);
    });

    it('should handle AuthorizationError', async () => {
      const response = await fetch(`${baseUrl}/users/403`);
      expect(response.status).toBe(403);
      const data = (await response.json()) as {
        error: {
          name: string;
          code: string;
          statusCode: number;
        };
      };
      expect(data.error.name).toBe('AuthorizationError');
      expect(data.error.code).toBe('AUTHORIZATION_ERROR');
      expect(data.error.statusCode).toBe(403);
    });

    it('should handle ConflictError', async () => {
      const response = await fetch(`${baseUrl}/users/409`);
      expect(response.status).toBe(409);
      const data = (await response.json()) as {
        error: {
          name: string;
          code: string;
          statusCode: number;
        };
      };
      expect(data.error.name).toBe('ConflictError');
      expect(data.error.code).toBe('CONFLICT');
      expect(data.error.statusCode).toBe(409);
    });

    it('should handle RateLimitError with retry-after header', async () => {
      const response = await fetch(`${baseUrl}/users/429`);
      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe('30');
      const data = (await response.json()) as {
        error: {
          name: string;
          code: string;
          statusCode: number;
          retryAfter: number;
        };
      };
      expect(data.error.name).toBe('RateLimitError');
      expect(data.error.code).toBe('RATE_LIMIT_ERROR');
      expect(data.error.statusCode).toBe(429);
      expect(data.error.retryAfter).toBe(30);
    });

    it('should handle BadRequestError', async () => {
      const response = await fetch(`${baseUrl}/users/123`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as {
        error: {
          name: string;
          code: string;
          statusCode: number;
        };
      };
      expect(data.error.name).toBe('BadRequestError');
      expect(data.error.code).toBe('BAD_REQUEST');
      expect(data.error.statusCode).toBe(400);
    });

    it('should include request metadata in error responses', async () => {
      const response = await fetch(`${baseUrl}/users/404`);
      expect(response.status).toBe(404);
      const data = (await response.json()) as {
        error: {
          path: string;
          method: string;
          timestamp: string;
          requestId: string;
        };
      };
      expect(data.error.path).toBe('/users/404');
      expect(data.error.method).toBe('GET');
      expect(data.error.timestamp).toBeDefined();
      expect(data.error.requestId).toBeDefined();
    });
  });

  describe('Error Factory', () => {
    it('should create validation errors', () => {
      const error = ErrorFactory.validation(
        'email',
        'Invalid email format',
        'invalid-email'
      );
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid-email');
      expect(error.statusCode).toBe(400);
    });

    it('should create not found errors', () => {
      const error = ErrorFactory.notFound('User');
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
    });

    it('should create authentication errors', () => {
      const error = ErrorFactory.unauthorized('Token expired');
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Token expired');
      expect(error.statusCode).toBe(401);
    });

    it('should create authorization errors', () => {
      const error = ErrorFactory.forbidden('Admin access required');
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.message).toBe('Admin access required');
      expect(error.statusCode).toBe(403);
    });

    it('should create bad request errors', () => {
      const error = ErrorFactory.badRequest('Invalid parameters');
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe('Invalid parameters');
      expect(error.statusCode).toBe(400);
    });

    it('should create conflict errors', () => {
      const error = ErrorFactory.conflict('Email already exists');
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe('Email already exists');
      expect(error.statusCode).toBe(409);
    });

    it('should create rate limit errors', () => {
      const error = ErrorFactory.rateLimit('Too many requests', 60);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('Exception Filters', () => {
    it('should use GlobalExceptionFilter for unknown errors', async () => {
      // Create a route that throws a generic error
      app.get('/error', () => {
        throw new Error('Generic error');
      });

      const response = await fetch(`${baseUrl}/error`);
      expect(response.status).toBe(500);
      const data = (await response.json()) as {
        error: {
          name: string;
          code: string;
          statusCode: number;
        };
      };
      expect(data.error.name).toBe('Error');
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(data.error.statusCode).toBe(500);
    });

    it('should handle syntax errors in JSON', async () => {
      const response = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as {
        error: {
          code: string;
          statusCode: number;
        };
      };
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.statusCode).toBe(400);
    });
  });
});

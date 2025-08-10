/**
 * Integration tests for NextRush v2 application
 *
 * Tests the complete application flow with all middleware
 */

import { createApp } from '@/index';
import type { Application, Context } from '@/types/context';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('Application Integration', () => {
  let app: Application;
  let server: any;
  const PORT = 3001;

  beforeAll(async () => {
    app = createApp({
      port: PORT,
      host: 'localhost',
      debug: true,
    });

    // Set up comprehensive middleware stack
    app.use(app.exceptionFilter()); // Add exception filter first
    app.use(app.helmet());
    app.use(
      app.cors({
        origin: ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
      })
    );
    // Add body parser middleware
    app.use(app.smartBodyParser());
    app.use(app.requestId());
    app.use(app.timer());
    app.use(app.rateLimit({ max: 100, windowMs: 15 * 60 * 1000 }));
    app.use(
      app.logger({
        format: 'combined',
        level: 'info',
        colorize: true,
      })
    );

    // Set up routes
    app.get('/', ctx => {
      ctx.res.json({ message: 'Hello, NextRush v2!' });
    });

    app.get('/health', ctx => {
      ctx.res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    app.post('/api/users', ctx => {
      console.log(`Route handler called with body:`, ctx.body);
      if (!ctx.body) {
        ctx.res.status(400).json({ error: 'Request body is required' });
        return;
      }

      // Handle large payloads (for testing)
      if ((ctx.body as any).message && (ctx.body as any).data) {
        ctx.res.status(201).json({
          id: 'user_123',
          message: (ctx.body as any).message,
          dataLength: (ctx.body as any).data.length,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      const { name, email } = ctx.body as { name: string; email: string };

      if (!name || !email) {
        ctx.res.status(400).json({ error: 'Name and email are required' });
        return;
      }

      ctx.res.status(201).json({
        id: 'user_123',
        name,
        email,
        createdAt: new Date().toISOString(),
      });
    });

    app.get('/api/users/:id', ctx => {
      const { id } = ctx.params;

      if (id === 'user_123') {
        ctx.res.json({
          id: 'user_123',
          name: 'John Doe',
          email: 'john@example.com',
          createdAt: new Date().toISOString(),
        });
      } else {
        ctx.res.status(404).json({ error: 'User not found' });
      }
    });

    app.put('/api/users/:id', ctx => {
      const { id } = ctx.params;
      const body = ctx.body as { name?: string; email?: string } | undefined;

      if (id === 'user_123') {
        ctx.res.json({
          id: 'user_123',
          name: body?.name || 'John Doe',
          email: body?.email || 'john@example.com',
          updatedAt: new Date().toISOString(),
        });
      } else {
        ctx.res.status(404).json({ error: 'User not found' });
      }
    });

    app.delete('/api/users/:id', ctx => {
      const { id } = ctx.params;

      if (id === 'user_123') {
        ctx.res.status(204).end();
      } else {
        ctx.res.status(404).json({ error: 'User not found' });
      }
    });

    // Error handling middleware
    app.use(async (ctx: Context, next: () => Promise<void>) => {
      try {
        await next();
      } catch (error) {
        console.error('Global error handler:', error);

        if (ctx.res.headersSent) {
          return;
        }

        ctx.res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    });

    server = app.listen(PORT);
  });

  afterAll(async () => {
    if (server) {
      await app.shutdown();
    }
  });

  beforeEach(() => {
    // Reset any state between tests
  });

  describe('Basic Application Flow', () => {
    it('should start the server and respond to health check', async () => {
      const response = await fetch(`http://localhost:${PORT}/health`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
    });

    it('should handle root route', async () => {
      const response = await fetch(`http://localhost:${PORT}/`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('message', 'Hello, NextRush v2!');
    });

    it('should include security headers', async () => {
      const response = await fetch(`http://localhost:${PORT}/health`);
      expect(response.status).toBe(200);

      // Check for security headers
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
      expect(response.headers.get('x-xss-protection')).toBe('1; mode=block');
    });

    it('should include CORS headers', async () => {
      const response = await fetch(`http://localhost:${PORT}/health`, {
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      expect(response.status).toBe(200);

      // Check for CORS headers
      expect(response.headers.get('access-control-allow-origin')).toBe(
        'http://localhost:3000'
      );
      expect(response.headers.get('access-control-allow-credentials')).toBe(
        'true'
      );
    });

    it('should include request ID header', async () => {
      const response = await fetch(`http://localhost:${PORT}/health`);
      expect(response.status).toBe(200);

      // Check for request ID header
      const requestId = response.headers.get('x-request-id');
      expect(requestId).toBeTruthy();
      expect(typeof requestId).toBe('string');
    });

    it('should include response time header', async () => {
      const response = await fetch(`http://localhost:${PORT}/health`);
      expect(response.status).toBe(200);

      // Check for response time header
      const responseTime = response.headers.get('x-response-time');
      expect(responseTime).toBeTruthy();
      expect(responseTime).toMatch(/^\d+ms$/);
    });
  });

  describe('API Endpoints', () => {
    it('should create a new user', async () => {
      const userData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
      };

      const response = await fetch(`http://localhost:${PORT}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty('id', 'user_123');
      expect(data).toHaveProperty('name', 'Jane Doe');
      expect(data).toHaveProperty('email', 'jane@example.com');
      expect(data).toHaveProperty('createdAt');
    });

    it('should return 400 for invalid user data', async () => {
      const response = await fetch(`http://localhost:${PORT}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'John' }), // Missing email
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Name and email are required');
    });

    it('should get user by ID', async () => {
      const response = await fetch(
        `http://localhost:${PORT}/api/users/user_123`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('id', 'user_123');
      expect(data).toHaveProperty('name', 'John Doe');
      expect(data).toHaveProperty('email', 'john@example.com');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await fetch(
        `http://localhost:${PORT}/api/users/non-existent`
      );
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'User not found');
    });

    it('should update user', async () => {
      const updateData = {
        name: 'John Updated',
        email: 'john.updated@example.com',
      };

      const response = await fetch(
        `http://localhost:${PORT}/api/users/user_123`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        }
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('id', 'user_123');
      expect(data).toHaveProperty('name', 'John Updated');
      expect(data).toHaveProperty('email', 'john.updated@example.com');
      expect(data).toHaveProperty('updatedAt');
    });

    it('should delete user', async () => {
      const response = await fetch(
        `http://localhost:${PORT}/api/users/user_123`,
        {
          method: 'DELETE',
        }
      );

      expect(response.status).toBe(204);
    });
  });

  describe('Middleware Integration', () => {
    it('should handle rate limiting', async () => {
      // Make multiple requests to trigger rate limiting
      const promises = Array.from({ length: 10 }, () =>
        fetch(`http://localhost:${PORT}/health`)
      );

      const responses = await Promise.all(promises);

      // All requests should succeed within the rate limit
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle large JSON payloads', async () => {
      const largeData = {
        message: 'Large payload test',
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `Description for item ${i}`,
        })),
      };

      const response = await fetch(`http://localhost:${PORT}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(largeData),
      });

      // Should handle large payloads gracefully
      expect(response.status).toBe(201);
    });

    it('should handle malformed JSON', async () => {
      const response = await fetch(`http://localhost:${PORT}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{"name": "John", "email": "john@example.com",}', // Malformed JSON
      });

      // Should handle malformed JSON gracefully
      expect(response.status).toBe(400);
    });

    it('should handle URL-encoded data', async () => {
      const formData = new URLSearchParams();
      formData.append('name', 'John Doe');
      formData.append('email', 'john@example.com');

      const response = await fetch(`http://localhost:${PORT}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty('name', 'John Doe');
      expect(data).toHaveProperty('email', 'john@example.com');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 routes gracefully', async () => {
      const response = await fetch(`http://localhost:${PORT}/non-existent`);
      expect(response.status).toBe(404);
    });

    it('should handle server errors gracefully', async () => {
      // Add a route that throws an error
      app.get('/error', () => {
        throw new Error('Test error');
      });

      const response = await fetch(`http://localhost:${PORT}/error`);
      expect(response.status).toBe(500);

      const data = (await response.json()) as any;
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('message', 'Internal Server Error');
      expect(data.error).toHaveProperty('statusCode', 500);
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests', async () => {
      const concurrentRequests = 50;
      const promises = Array.from({ length: concurrentRequests }, () =>
        fetch(`http://localhost:${PORT}/health`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should have reasonable response times', async () => {
      const response = await fetch(`http://localhost:${PORT}/health`);
      expect(response.status).toBe(200);

      const responseTime = response.headers.get('x-response-time');
      const timeInMs = parseInt(responseTime?.replace('ms', '') || '0');

      // Response time should be reasonable (less than 100ms for simple requests)
      expect(timeInMs).toBeLessThan(100);
    });
  });
});

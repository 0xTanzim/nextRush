/**
 * End-to-End Event System Tests
 *
 * Complete integration tests for the hybrid event system
 * in a real application scenario.
 *
 * @version 2.0.0
 */

import type { NextRushApplication } from '@/core/app/application';
import { smartBodyParser } from '@/core/middleware/body-parser';
import { createApp } from '@/index';
import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('E2E Event System Integration', () => {
  let app: NextRushApplication;
  let server: http.Server;

  beforeEach(() => {
    app = createApp();
  });

  afterEach(async () => {
    // Clean up
    app.events.removeAllListeners();
    if (server?.listening) {
      await new Promise<void>(resolve => {
        server.close(() => resolve());
      });
    }
  });

  describe('Real-world Event Scenarios', () => {
    it('should handle user authentication events in a complete flow', async () => {
      // Arrange - Set up a realistic user authentication system
      const authEvents: Array<{ event: string; user: any; timestamp: number }> =
        [];

      // Set up event listeners for auth flow
      app.events.on('user.login.attempt', data => {
        authEvents.push({
          event: 'login.attempt',
          user: data,
          timestamp: Date.now(),
        });
      });

      app.events.on('user.login.success', data => {
        authEvents.push({
          event: 'login.success',
          user: data,
          timestamp: Date.now(),
        });
        // Trigger follow-up events
        app.events.emit('user.session.created', {
          userId: data.userId,
          sessionId: data.sessionId,
        });
      });

      app.events.on('user.session.created', data => {
        authEvents.push({
          event: 'session.created',
          user: data,
          timestamp: Date.now(),
        });
      });

      app.events.on('user.login.failed', data => {
        authEvents.push({
          event: 'login.failed',
          user: data,
          timestamp: Date.now(),
        });
      });

      // Set up API endpoints that emit events

      // Add body parser middleware before routes
      app.use(smartBodyParser());

      app.post('/auth/login', async ctx => {
        const { email, password } = ctx.body as {
          email: string;
          password: string;
        };

        // Emit login attempt
        await app.events.emit('user.login.attempt', { email });

        // Simulate authentication logic
        if (email === 'john@example.com' && password === 'password123') {
          const userData = {
            userId: '123',
            email,
            sessionId: 'sess_' + Math.random().toString(36),
          };

          // Emit success event
          await app.events.emit('user.login.success', userData);

          ctx.res.status(200).json({ success: true, user: userData });
        } else {
          // Emit failure event
          await app.events.emit('user.login.failed', {
            email,
            reason: 'invalid_credentials',
          });

          ctx.res
            .status(401)
            .json({ success: false, error: 'Invalid credentials' });
        }
      });

      // Start server
      server = app.getServer();
      await new Promise<void>(resolve => {
        server.listen(0, () => resolve());
      });

      const address = server.address() as any;
      const port = address.port;

      // Act - Make API requests that trigger events

      // Successful login
      const successResponse = await fetch(
        `http://localhost:${port}/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'john@example.com',
            password: 'password123',
          }),
        }
      );

      // Failed login
      const failResponse = await fetch(`http://localhost:${port}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'john@example.com', password: 'wrong' }),
      });

      // Wait for events to propagate
      await new Promise(resolve => setTimeout(resolve, 50));

      // Assert
      expect(successResponse.status).toBe(200);
      expect(failResponse.status).toBe(401);

      // Verify event flow
      expect(authEvents).toHaveLength(5); // 2 attempts + 1 success + 1 session + 1 failure

      // Check event sequence
      const eventTypes = authEvents.map(e => e.event);
      expect(eventTypes).toContain('login.attempt');
      expect(eventTypes).toContain('login.success');
      expect(eventTypes).toContain('session.created');
      expect(eventTypes).toContain('login.failed');

      // Verify event data integrity
      const successEvent = authEvents.find(e => e.event === 'login.success');
      expect(successEvent?.user.email).toBe('john@example.com');
      expect(successEvent?.user.sessionId).toMatch(/^sess_/);
    });

    it('should handle API request lifecycle events', async () => {
      // Arrange
      const requestEvents: Array<{ event: string; data: any }> = [];

      // Set up middleware that emits events
      app.use(async (ctx, next) => {
        // Emit request start event
        await app.events.emit('request.start', {
          method: ctx.method,
          path: ctx.path,
          timestamp: Date.now(),
        });

        await next();

        // Emit request end event
        await app.events.emit('request.end', {
          method: ctx.method,
          path: ctx.path,
          status: ctx.res.statusCode,
          timestamp: Date.now(),
        });
      });

      // Set up event listeners
      app.events.on('request.start', data => {
        requestEvents.push({ event: 'start', data });
      });

      app.events.on('request.end', data => {
        requestEvents.push({ event: 'end', data });
      });

      // Create API endpoint
      app.get('/api/test', async ctx => {
        await app.events.emit('api.test.called', { timestamp: Date.now() });
        ctx.res.json({ message: 'API called successfully' });
      });

      app.events.on('api.test.called', data => {
        requestEvents.push({ event: 'api.called', data });
      });

      // Start server
      server = app.getServer();
      await new Promise<void>(resolve => {
        server.listen(0, () => resolve());
      });

      const address = server.address() as any;
      const port = address.port;

      // Act
      const response = await fetch(`http://localhost:${port}/api/test`);
      await new Promise(resolve => setTimeout(resolve, 100)); // Increased wait time for async events

      // Assert
      expect(response.status).toBe(200);
      expect(requestEvents).toHaveLength(3); // start, api.called, end

      // Find events by type instead of assuming order
      const startEvent = requestEvents.find(e => e.event === 'start');
      const apiEvent = requestEvents.find(e => e.event === 'api.called');
      const endEvent = requestEvents.find(e => e.event === 'end');

      expect(startEvent?.event).toBe('start');
      expect(startEvent?.data.method).toBe('GET');
      expect(startEvent?.data.path).toBe('/api/test');

      expect(apiEvent?.event).toBe('api.called');

      expect(endEvent?.event).toBe('end');
      expect(endEvent?.data.status).toBe(200);
    });

    it('should handle error scenarios with event propagation', async () => {
      // Arrange
      const errorEvents: Array<{ event: string; error: any }> = [];

      // Set up error event listeners
      app.events.on('error.api', data => {
        errorEvents.push({ event: 'api.error', error: data });
      });

      app.events.on('error.validation', data => {
        errorEvents.push({ event: 'validation.error', error: data });
      });

      // Create endpoint that validates and can error

      // Add body parser middleware for this test
      app.use(smartBodyParser());

      app.post('/api/users', async ctx => {
        try {
          const { name, email } = ctx.body as { name?: string; email?: string };

          // Validation
          if (!name || !email) {
            await app.events.emit('error.validation', {
              field: !name ? 'name' : 'email',
              message: 'Field is required',
            });
            ctx.res.status(400).json({ error: 'Validation failed' });
            return;
          }

          // Simulate API error
          if (email === 'error@example.com') {
            throw new Error('Simulated API error');
          }

          ctx.res.status(201).json({ user: { name, email } });
        } catch (error) {
          await app.events.emit('error.api', {
            error: (error as Error).message,
            endpoint: '/api/users',
          });
          ctx.res.status(500).json({ error: 'Internal server error' });
        }
      });

      // Start server
      server = app.getServer();
      await new Promise<void>(resolve => {
        server.listen(0, () => resolve());
      });

      const address = server.address() as any;
      const port = address.port;

      // Act - Make requests that trigger different errors

      // Validation error
      const validationResponse = await fetch(
        `http://localhost:${port}/api/users`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'John' }), // Missing email
        }
      );

      // API error
      const apiErrorResponse = await fetch(
        `http://localhost:${port}/api/users`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Jane', email: 'error@example.com' }),
        }
      );

      await new Promise(resolve => setTimeout(resolve, 50));

      // Assert
      expect(validationResponse.status).toBe(400);
      expect(apiErrorResponse.status).toBe(500);

      expect(errorEvents).toHaveLength(2);

      const validationError = errorEvents.find(
        e => e.event === 'validation.error'
      );
      expect(validationError?.error.field).toBe('email');

      const apiError = errorEvents.find(e => e.event === 'api.error');
      expect(apiError?.error.error).toBe('Simulated API error');
    });
  });

  describe('Event Performance Under Load', () => {
    it('should handle high-frequency events efficiently', async () => {
      // Arrange
      let eventCount = 0;
      const startTime = Date.now();

      app.events.on('performance.test', () => {
        eventCount++;
      });

      // Create endpoint that emits events rapidly
      app.get('/api/events/:count', async ctx => {
        const count = parseInt(ctx.params['count'] || '0');

        // Emit multiple events
        const promises = [];
        for (let i = 0; i < count; i++) {
          promises.push(app.events.emit('performance.test', { index: i }));
        }

        await Promise.all(promises);
        ctx.res.json({ eventsEmitted: count });
      });

      // Start server
      server = app.getServer();
      await new Promise<void>(resolve => {
        server.listen(0, () => resolve());
      });

      const address = server.address() as any;
      const port = address.port;

      // Act
      const response = await fetch(`http://localhost:${port}/api/events/100`);
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for events to process

      const endTime = Date.now();

      // Assert
      expect(response.status).toBe(200);
      expect(eventCount).toBe(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });
  });
});

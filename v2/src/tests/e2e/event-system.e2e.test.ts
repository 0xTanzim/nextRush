/**
 * @fileoverview E2E tests for NextRush Event System
 * Tests complete business workflows end-to-end
 */

import { NextRushEventSystem } from '@/core/events/event-system';
import { createApp } from '@/index';
import type { Server } from 'http';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

describe('Event System E2E Tests', () => {
  let eventSystem: NextRushEventSystem;
  let testServer: Server;
  const port = 3001; // Different port to avoid conflicts

  // Mock data stores
  const users = new Map<string, any>();
  const orders = new Map<string, any>();
  const products = new Map<string, any>();

  beforeAll(async () => {
    // Initialize mock products
    products.set('prod-1', {
      id: 'prod-1',
      name: 'Widget A',
      price: 29.99,
      stock: 100,
    });
    products.set('prod-2', {
      id: 'prod-2',
      name: 'Widget B',
      price: 49.99,
      stock: 50,
    });

    // Create NextRush application with event system
    const app = createApp();
    eventSystem = new NextRushEventSystem();

    // Setup JSON body parser middleware
    app.use(async (ctx: any, next: any) => {
      if (
        ctx.method === 'POST' &&
        ctx.headers['content-type']?.includes('application/json')
      ) {
        const body = await new Promise<string>(resolve => {
          let data = '';
          ctx.req.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          ctx.req.on('end', () => {
            resolve(data);
          });
        });
        try {
          ctx.body = JSON.parse(body);
        } catch {
          ctx.body = {};
        }
      }
      await next();
    });

    // Setup event handlers
    setupBusinessEventHandlers();

    // Setup HTTP endpoints
    setupHttpEndpoints(app);

    // Start server and wait for it to be ready
    await new Promise<void>((resolve, reject) => {
      const server = app.listen(port, '127.0.0.1', () => {
        console.log(`E2E Test server listening on port ${port}`);
        testServer = server as Server;
        resolve();
      }) as Server;

      server.on('error', (err: any) => {
        console.error('Server start error:', err);
        reject(err);
      });
    });

    // Wait a bit more to ensure server is ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 30000);

  afterAll(async () => {
    if (testServer) {
      await new Promise<void>(resolve => {
        testServer.close(() => {
          console.log('E2E Test server closed');
          resolve();
        });
      });
    }
  }, 10000);

  function setupBusinessEventHandlers() {
    // User Registration Events
    eventSystem.subscribe('UserRegistered', async (event: any) => {
      const { userId, email, name } = event.data;

      // Simulate user creation in database
      const user = {
        id: userId,
        email,
        name,
        status: 'pending',
        createdAt: new Date(),
      };
      users.set(userId, user);

      // Emit email verification event
      await eventSystem.emitEvent('EmailVerificationRequired', {
        userId,
        email,
      });
    });

    eventSystem.subscribe('EmailVerificationRequired', async (event: any) => {
      const { userId } = event.data;

      // Simulate email verification process
      const user = users.get(userId);
      if (user) {
        user.status = 'verified';
        users.set(userId, user);

        await eventSystem.emitEvent('UserActivated', {
          userId,
          activatedAt: new Date(),
        });
      }
    });

    // Order Processing Events
    eventSystem.subscribe('OrderCreated', async (event: any) => {
      const { orderId, userId, items, totalAmount } = event.data;

      // Check inventory for all items
      let hasInventory = true;
      for (const item of items) {
        const product = products.get(item.productId);
        if (!product || product.stock < item.quantity) {
          hasInventory = false;
          break;
        }
      }

      if (hasInventory) {
        // Reserve inventory
        for (const item of items) {
          const product = products.get(item.productId);
          if (product) {
            product.stock -= item.quantity;
            products.set(product.id, product);
          }
        }

        const order = {
          id: orderId,
          userId,
          items,
          totalAmount,
          status: 'confirmed',
          createdAt: new Date(),
        };
        orders.set(orderId, order);

        await eventSystem.emitEvent('OrderConfirmed', {
          orderId,
          userId,
          reservationId: `res-${orderId}`,
        });
      } else {
        const order = {
          id: orderId,
          userId,
          items,
          totalAmount,
          status: 'failed',
          failureReason: 'Insufficient inventory',
          createdAt: new Date(),
        };
        orders.set(orderId, order);

        await eventSystem.emitEvent('OrderFailed', {
          orderId,
          userId,
          reason: 'Insufficient inventory',
        });
      }
    });

    eventSystem.subscribe('OrderConfirmed', async (event: any) => {
      const { orderId } = event.data;

      const order = orders.get(orderId);
      if (order) {
        order.status = 'processing';
        orders.set(orderId, order);

        // Simulate payment processing
        await eventSystem.emitEvent('PaymentProcessed', {
          orderId,
          paymentId: `pay-${orderId}`,
          amount: order.totalAmount,
        });
      }
    });

    eventSystem.subscribe('PaymentProcessed', async (event: any) => {
      const { orderId } = event.data;

      const order = orders.get(orderId);
      if (order) {
        order.status = 'paid';
        order.paymentProcessedAt = new Date();
        orders.set(orderId, order);

        // Initiate shipping
        await eventSystem.emitEvent('ShippingInitiated', {
          orderId,
          shippingId: `ship-${orderId}`,
        });
      }
    });
  }

  function setupHttpEndpoints(app: any) {
    // User registration endpoint
    app.post('/users', async (ctx: any) => {
      const { email, name } = ctx.body;
      const userId = `user-${Date.now()}`;

      try {
        // Emit user registration event
        await eventSystem.emitEvent('UserRegistered', {
          userId,
          email,
          name,
        });

        ctx.res.status(201).json({
          success: true,
          data: { userId, email, name },
        });
      } catch (error: any) {
        ctx.res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Order creation endpoint
    app.post('/orders', async (ctx: any) => {
      const { userId, items } = ctx.body;
      const orderId = `order-${Date.now()}`;

      // Calculate total
      const totalAmount = items.reduce((sum: number, item: any) => {
        const product = products.get(item.productId);
        return sum + (product ? product.price * item.quantity : 0);
      }, 0);

      try {
        await eventSystem.emitEvent('OrderCreated', {
          orderId,
          userId,
          items,
          totalAmount,
        });

        ctx.res.status(201).json({
          success: true,
          data: { orderId, userId, items, totalAmount },
        });
      } catch (error: any) {
        ctx.res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get user status endpoint
    app.get('/users/:userId', async (ctx: any) => {
      const userId = ctx.params?.['userId'];
      const user = users.get(userId);

      if (user) {
        ctx.res.json({ success: true, data: user });
      } else {
        ctx.res.status(404).json({ success: false, error: 'User not found' });
      }
    });

    // Get order status endpoint
    app.get('/orders/:orderId', async (ctx: any) => {
      const orderId = ctx.params?.['orderId'];
      const order = orders.get(orderId);

      if (order) {
        ctx.res.json({ success: true, data: order });
      } else {
        ctx.res.status(404).json({ success: false, error: 'Order not found' });
      }
    });

    // Get product endpoint
    app.get('/products/:productId', async (ctx: any) => {
      const productId = ctx.params?.['productId'];
      const product = products.get(productId);

      if (product) {
        ctx.res.json({ success: true, data: product });
      } else {
        ctx.res
          .status(404)
          .json({ success: false, error: 'Product not found' });
      }
    });
  }

  describe('Complete User Registration Workflow', () => {
    test('should complete full user registration process', async () => {
      // Register user
      const response = await fetch(`http://localhost:${port}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'Test User',
        }),
      });

      expect(response.ok).toBe(true);
      const result: any = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.userId).toMatch(/^user-\d+$/);

      const userId = result.data.userId;

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check user status
      const userResponse = await fetch(
        `http://localhost:${port}/users/${userId}`
      );
      expect(userResponse.ok).toBe(true);

      const userResult: any = await userResponse.json();
      expect(userResult.success).toBe(true);
      expect(userResult.data.status).toBe('verified');
      expect(userResult.data.email).toBe('test@example.com');
    });
  });

  describe('Complete Order Processing Workflow', () => {
    test('should complete successful order process with sufficient inventory', async () => {
      // First register a user
      const userResponse = await fetch(`http://localhost:${port}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'buyer@example.com',
          name: 'Test Buyer',
        }),
      });

      const userResult: any = await userResponse.json();
      const userId = userResult.data.userId;

      // Wait for user registration to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create order with available inventory
      const orderResponse = await fetch(`http://localhost:${port}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          items: [
            { productId: 'prod-1', quantity: 2 },
            { productId: 'prod-2', quantity: 1 },
          ],
        }),
      });

      expect(orderResponse.ok).toBe(true);
      const orderResult: any = await orderResponse.json();
      expect(orderResult.success).toBe(true);

      const orderId = orderResult.data.orderId;

      // Wait for order processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check final order status
      const statusResponse = await fetch(
        `http://localhost:${port}/orders/${orderId}`
      );
      const statusResult: any = await statusResponse.json();

      expect(statusResult.success).toBe(true);
      expect(statusResult.data.status).toBe('paid');
      expect(statusResult.data.paymentProcessedAt).toBeDefined();

      // Verify inventory was updated
      const product1Response = await fetch(
        `http://localhost:${port}/products/prod-1`
      );
      const product1Result: any = await product1Response.json();
      expect(product1Result.data.stock).toBe(98); // 100 - 2

      const product2Response = await fetch(
        `http://localhost:${port}/products/prod-2`
      );
      const product2Result: any = await product2Response.json();
      expect(product2Result.data.stock).toBe(49); // 50 - 1
    });

    test('should handle insufficient inventory gracefully', async () => {
      // Register user
      const userResponse = await fetch(`http://localhost:${port}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'failedbuyer@example.com',
          name: 'Failed Buyer',
        }),
      });

      const userResult: any = await userResponse.json();
      const userId = userResult.data.userId;

      // Wait for user registration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to order more than available inventory
      const orderResponse = await fetch(`http://localhost:${port}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          items: [
            { productId: 'prod-1', quantity: 200 }, // More than available (98 remaining)
          ],
        }),
      });

      expect(orderResponse.ok).toBe(true);
      const orderResult: any = await orderResponse.json();
      const orderId = orderResult.data.orderId;

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check order failed
      const statusResponse = await fetch(
        `http://localhost:${port}/orders/${orderId}`
      );
      const statusResult: any = await statusResponse.json();

      expect(statusResult.success).toBe(true);
      expect(statusResult.data.status).toBe('failed');
      expect(statusResult.data.failureReason).toBe('Insufficient inventory');
    });
  });

  describe('Complex Multi-Service Workflow', () => {
    test('should handle user registration and immediate order placement', async () => {
      // Register and create order in parallel workflows
      const registrationResponse = await fetch(
        `http://localhost:${port}/users`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'quickbuyer@example.com',
            name: 'Quick Buyer',
          }),
        }
      );

      const userResult: any = await registrationResponse.json();
      const userId = userResult.data.userId;

      // Wait for user to be processed
      await new Promise(resolve => setTimeout(resolve, 150));

      // Immediately place order
      const orderResponse = await fetch(`http://localhost:${port}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          items: [{ productId: 'prod-2', quantity: 3 }],
        }),
      });

      const orderResult: any = await orderResponse.json();
      const orderId = orderResult.data.orderId;

      // Wait for all processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify user is active and order is processed
      const userStatusResponse = await fetch(
        `http://localhost:${port}/users/${userId}`
      );
      const userStatusResult: any = await userStatusResponse.json();
      expect(userStatusResult.data.status).toBe('verified');

      const orderStatusResponse = await fetch(
        `http://localhost:${port}/orders/${orderId}`
      );
      const orderStatusResult: any = await orderStatusResponse.json();
      expect(orderStatusResult.data.status).toBe('paid');
    });
  });
});

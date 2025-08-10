/**
 * NextRush v2 Event System Playground
 *
 * Simple, interactive examples for learning and testing the event system.
 * Perfect for beginners to understand how the event system works.
 */

import { NextRushEventSystem } from '../src/core/events';
import { createApp } from '../src/index';
import type { Event } from '../src/types/events';

console.log('🚀 NextRush v2 Event System Playground');
console.log('=====================================');

// Example 1: Basic Event Emission and Subscription
async function basicEventExample() {
  console.log('\n📝 Example 1: Basic Events');
  console.log('----------------------------');

  // Create event system
  const eventSystem = new NextRushEventSystem();

  // Subscribe to user events
  eventSystem.subscribe('user.*', async (event: Event) => {
    console.log(`✅ User event received: ${event.type}`, event.data);
  });

  // Emit some user events
  await eventSystem.emit({
    type: 'user.created',
    data: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
    metadata: {
      id: 'evt-1',
      timestamp: Date.now(),
      source: 'playground',
      version: 1,
    },
  });

  await eventSystem.emit({
    type: 'user.updated',
    data: { id: 'user-1', name: 'John Smith' },
    metadata: {
      id: 'evt-2',
      timestamp: Date.now(),
      source: 'playground',
      version: 1,
    },
  });

  console.log('✨ Basic events completed!');
}

// Example 2: Event Chains and Workflows
async function eventChainExample() {
  console.log('\n🔗 Example 2: Event Chains');
  console.log('----------------------------');

  const eventSystem = new NextRushEventSystem();
  const processLog: string[] = [];

  // Set up event chain: registration -> email -> verification -> welcome
  eventSystem.subscribe('user.registered', async (event: Event) => {
    const { email, name } = event.data as { email: string; name: string };
    processLog.push(`📧 Sending verification email to ${email}`);

    // Simulate async email sending
    setTimeout(async () => {
      await eventSystem.emit({
        type: 'user.verification_sent',
        data: { email, sentAt: Date.now() },
        metadata: {
          id: `evt-email-${Date.now()}`,
          timestamp: Date.now(),
          source: 'email-service',
          version: 1,
          causationId: event.metadata.id,
        },
      });
    }, 100);
  });

  eventSystem.subscribe('user.verification_sent', async (event: Event) => {
    const { email } = event.data as { email: string };
    processLog.push(`✅ Email sent to ${email}`);

    // Auto-verify for demo
    setTimeout(async () => {
      await eventSystem.emit({
        type: 'user.verified',
        data: { email, verifiedAt: Date.now() },
        metadata: {
          id: `evt-verify-${Date.now()}`,
          timestamp: Date.now(),
          source: 'email-service',
          version: 1,
          causationId: event.metadata.id,
        },
      });
    }, 50);
  });

  eventSystem.subscribe('user.verified', async (event: Event) => {
    const { email } = event.data as { email: string };
    processLog.push(`🎉 User ${email} verified!`);

    await eventSystem.emit({
      type: 'user.welcome_sent',
      data: { email, welcomedAt: Date.now() },
      metadata: {
        id: `evt-welcome-${Date.now()}`,
        timestamp: Date.now(),
        source: 'marketing-service',
        version: 1,
        causationId: event.metadata.id,
      },
    });
  });

  eventSystem.subscribe('user.welcome_sent', async (event: Event) => {
    const { email } = event.data as { email: string };
    processLog.push(`💌 Welcome email sent to ${email}`);
  });

  // Trigger the chain
  await eventSystem.emit({
    type: 'user.registered',
    data: { email: 'alice@example.com', name: 'Alice Johnson' },
    metadata: {
      id: 'evt-start',
      timestamp: Date.now(),
      source: 'playground',
      version: 1,
    },
  });

  // Wait for chain to complete
  await new Promise(resolve => setTimeout(resolve, 300));

  console.log('Process log:');
  processLog.forEach((step, index) => {
    console.log(`${index + 1}. ${step}`);
  });

  console.log('✨ Event chain completed!');
}

// Example 3: HTTP Integration
async function httpIntegrationExample() {
  console.log('\n🌐 Example 3: HTTP Integration');
  console.log('-------------------------------');

  const eventSystem = new NextRushEventSystem();
  const app = createApp();

  // Track events for display
  const eventLog: Event[] = [];
  eventSystem.subscribe('*', async (event: Event) => {
    eventLog.push(event);
  });

  // Simple user service with events
  const users = new Map<string, any>();

  app.post('/users', async ctx => {
    const { name, email } = ctx.body as { name: string; email: string };

    const user = {
      id: `user-${Date.now()}`,
      name,
      email,
      createdAt: Date.now(),
    };

    users.set(user.id, user);

    // Emit user created event
    await eventSystem.emit({
      type: 'user.created',
      data: user,
      metadata: {
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        source: 'user-api',
        version: 1,
      },
    });

    ctx.body = user;
  });

  app.get('/users/:id', async ctx => {
    const userId = ctx.params['id'];
    const user = users.get(userId || '');

    if (!user) {
      ctx.status = 404;
      ctx.body = { error: 'User not found' };
      return;
    }

    // Emit user viewed event
    await eventSystem.emit({
      type: 'user.viewed',
      data: { userId: user.id, viewedAt: Date.now() },
      metadata: {
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        source: 'user-api',
        version: 1,
      },
    });

    ctx.body = user;
  });

  app.get('/events', async ctx => {
    ctx.body = {
      events: eventLog.slice(-10),
      total: eventLog.length,
    };
  });

  // Start server
  const server = await app.listen(3001);
  console.log('🚀 Server started on http://localhost:3001');

  console.log('\nTry these requests:');
  console.log('POST http://localhost:3001/users');
  console.log('  Body: {"name": "Test User", "email": "test@example.com"}');
  console.log('GET http://localhost:3001/events');
  console.log('\nPress Ctrl+C to stop the server');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down server...');
    server.close();
    process.exit(0);
  });
}

// Example 4: Event Store and Replay
async function eventStoreExample() {
  console.log('\n💾 Example 4: Event Store');
  console.log('---------------------------');

  const eventSystem = new NextRushEventSystem({
    enableEventStore: true,
    eventStoreType: 'memory',
  });

  // Emit several events
  const events = [
    {
      type: 'order.created',
      data: { orderId: 'order-1', amount: 99.99 },
      metadata: {
        id: 'evt-1',
        timestamp: Date.now(),
        source: 'order-api',
        version: 1,
      },
    },
    {
      type: 'order.paid',
      data: { orderId: 'order-1', paidAt: Date.now() },
      metadata: {
        id: 'evt-2',
        timestamp: Date.now(),
        source: 'payment-api',
        version: 1,
      },
    },
    {
      type: 'order.shipped',
      data: { orderId: 'order-1', shippedAt: Date.now() },
      metadata: {
        id: 'evt-3',
        timestamp: Date.now(),
        source: 'shipping-api',
        version: 1,
      },
    },
  ];

  for (const event of events) {
    await eventSystem.emit(event);
    console.log(`📝 Stored: ${event.type}`);
  }

  // Load events back
  const storedEvents = await eventSystem.loadAggregateEvents('order-1');
  console.log(`📚 Loaded ${storedEvents.length} events from store`);

  storedEvents.forEach((event, index) => {
    console.log(
      `  ${index + 1}. ${event.type} - ${JSON.stringify(event.data)}`
    );
  });

  console.log('✨ Event store example completed!');
}

// Example 5: Error Handling
async function errorHandlingExample() {
  console.log('\n⚠️  Example 5: Error Handling');
  console.log('------------------------------');

  const eventSystem = new NextRushEventSystem();
  const errors: Error[] = [];

  // Set up a failing event handler
  eventSystem.subscribe('test.failing', async (event: Event) => {
    if ((event.data as any).shouldFail) {
      throw new Error('This handler always fails!');
    }
    console.log('✅ Event processed successfully');
  });

  // Custom error handling
  const originalEmit = eventSystem.emit.bind(eventSystem);
  eventSystem.emit = async (event: Event) => {
    try {
      await originalEmit(event);
    } catch (error) {
      errors.push(error as Error);
      console.log(
        `❌ Error processing ${event.type}: ${(error as Error).message}`
      );
    }
  };

  // Emit failing event
  await eventSystem.emit({
    type: 'test.failing',
    data: { shouldFail: true },
    metadata: {
      id: 'evt-fail',
      timestamp: Date.now(),
      source: 'playground',
      version: 1,
    },
  });

  // Emit successful event
  await eventSystem.emit({
    type: 'test.failing',
    data: { shouldFail: false },
    metadata: {
      id: 'evt-success',
      timestamp: Date.now(),
      source: 'playground',
      version: 1,
    },
  });

  console.log(`\n📊 Captured ${errors.length} errors`);
  console.log('✨ Error handling example completed!');
}

// Main playground runner
async function runPlayground() {
  try {
    await basicEventExample();
    await eventChainExample();
    await eventStoreExample();
    await errorHandlingExample();

    console.log('\n🎮 Interactive Examples:');
    console.log('========================');

    // Check if we're running in an environment where we can start a server
    if (process.argv.includes('--interactive')) {
      await httpIntegrationExample();
    } else {
      console.log('✨ All basic examples completed!');
      console.log('🌟 Run with --interactive flag to try HTTP integration');
      console.log(
        '\nExample: node playground/event-system-demo.js --interactive'
      );
    }
  } catch (error) {
    console.error('❌ Playground error:', error);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  runPlayground().catch(console.error);
}

export {
  basicEventExample,
  errorHandlingExample,
  eventChainExample,
  eventStoreExample,
  httpIntegrationExample,
  runPlayground,
};

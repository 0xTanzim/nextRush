/**
 * NextRush v2 Event System Tests
 *
 * Comprehensive test suite for the complete CQRS event system
 * with commands, queries, event sourcing, and integration testing.
 *
 * @version 2.0.0
 * @author NextRush Core Team
 */

import { setTimeout } from 'node:timers/promises';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { NextRushEventSystem, createEventSystem } from '@/core/events';

import type { Command, DomainEvent, EventHandler, Query } from '@/types/events';

// Test domain types
interface UserAggregate {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  version: number;
}

// Test commands
type CreateUserCommand = Command<
  'CreateUser',
  {
    email: string;
    name: string;
  }
>;

// Test queries
type GetUserQuery = Query<'GetUser', { userId: string }, UserAggregate | null>;

type ListUsersQuery = Query<
  'ListUsers',
  {
    limit?: number;
    offset?: number;
    activeOnly?: boolean;
  },
  {
    users: UserAggregate[];
    total: number;
  }
>;

// Test events
type UserCreatedEvent = DomainEvent<
  'UserCreated',
  {
    userId: string;
    email: string;
    name: string;
  }
>;

// Test service for managing users
class UserService {
  private users = new Map<string, UserAggregate>();

  constructor(private eventSystem: NextRushEventSystem) {}

  async createUser(email: string, name: string): Promise<UserAggregate> {
    const user: UserAggregate = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      email,
      name,
      isActive: true,
      createdAt: new Date(),
      version: 1,
    };

    this.users.set(user.id, user);

    // Emit domain event
    const event: UserCreatedEvent = {
      type: 'UserCreated',
      data: { userId: user.id, email, name },
      metadata: {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        source: 'UserService',
        version: 1,
      },
      aggregateId: user.id,
      aggregateType: 'User',
      sequenceNumber: 1,
    };

    await this.eventSystem.emit(event);

    return user;
  }

  getUser(userId: string): UserAggregate | null {
    return this.users.get(userId) || null;
  }

  listUsers(
    options: { limit?: number; offset?: number; activeOnly?: boolean } = {}
  ): {
    users: UserAggregate[];
    total: number;
  } {
    let users = Array.from(this.users.values());

    if (options.activeOnly) {
      users = users.filter(u => u.isActive);
    }

    const total = users.length;

    if (options.offset) {
      users = users.slice(options.offset);
    }

    if (options.limit) {
      users = users.slice(0, options.limit);
    }

    return { users, total };
  }
}

describe('NextRushEventSystem', () => {
  let eventSystem: NextRushEventSystem;
  let userService: UserService;

  beforeEach(async () => {
    eventSystem = createEventSystem()
      .withEventStore('memory', 1000)
      .withMonitoring()
      .build();

    // Don't call eventSystem.clear() as it destroys essential system subscriptions
    // like the wildcard subscription for event persistence!
    // The event system is created fresh for each test anyway.

    userService = new UserService(eventSystem);
  });

  describe('Event System Initialization', () => {
    test('should create event system with default configuration', () => {
      const system = createEventSystem().build();

      expect(system).toBeInstanceOf(NextRushEventSystem);
    });

    test('should create event system with custom configuration', () => {
      const system = createEventSystem()
        .withEventStore('memory', 500)
        .withMonitoring()
        .withTimeout(10000)
        .build();

      expect(system).toBeInstanceOf(NextRushEventSystem);
    });

    test('should create event system without event store', () => {
      const system = createEventSystem()
        .withoutEventStore()
        .withoutMonitoring()
        .build();

      expect(system).toBeInstanceOf(NextRushEventSystem);
    });
  });

  describe('Command Handling', () => {
    test('should register and execute command handlers', async () => {
      const createUserHandler = async (
        command: CreateUserCommand
      ): Promise<UserAggregate> => {
        return userService.createUser(command.data.email, command.data.name);
      };

      eventSystem.registerCommandHandler('CreateUser', createUserHandler);

      const command: CreateUserCommand = {
        type: 'CreateUser',
        data: { email: 'john@example.com', name: 'John Doe' },
        metadata: {
          id: 'cmd-1',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
        },
      };

      const result = await eventSystem.executeCommand<
        CreateUserCommand,
        UserAggregate
      >(command);

      expect(result.id).toBeDefined();
      expect(result.email).toBe('john@example.com');
      expect(result.name).toBe('John Doe');
      expect(result.isActive).toBe(true);
    });

    test('should throw error for unregistered command', async () => {
      const command: Command<'UnknownCommand', unknown> = {
        type: 'UnknownCommand',
        data: {},
        metadata: {
          id: 'cmd-1',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
        },
      };

      await expect(eventSystem.executeCommand(command)).rejects.toThrow(
        'No handler registered for command type: UnknownCommand'
      );
    });

    test('should handle command execution errors', async () => {
      const failingHandler = async (): Promise<UserAggregate> => {
        throw new Error('Database connection failed');
      };

      eventSystem.registerCommandHandler('CreateUser', failingHandler);

      const command: CreateUserCommand = {
        type: 'CreateUser',
        data: { email: 'test@example.com', name: 'Test User' },
        metadata: {
          id: 'cmd-1',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
        },
      };

      await expect(
        eventSystem.executeCommand<CreateUserCommand, UserAggregate>(command)
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('Query Handling', () => {
    beforeEach(async () => {
      // Set up test data
      const createUserHandler = async (
        command: CreateUserCommand
      ): Promise<UserAggregate> => {
        return userService.createUser(command.data.email, command.data.name);
      };

      eventSystem.registerCommandHandler('CreateUser', createUserHandler);

      // Create test users
      await eventSystem.executeCommand<CreateUserCommand, UserAggregate>({
        type: 'CreateUser',
        data: { email: 'user1@example.com', name: 'User One' },
        metadata: {
          id: 'cmd-1',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
        },
      });

      await eventSystem.executeCommand<CreateUserCommand, UserAggregate>({
        type: 'CreateUser',
        data: { email: 'user2@example.com', name: 'User Two' },
        metadata: {
          id: 'cmd-2',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
        },
      });
    });

    test('should register and execute query handlers', async () => {
      const getUserHandler = async (
        query: GetUserQuery
      ): Promise<UserAggregate | null> => {
        return userService.getUser(query.data.userId);
      };

      eventSystem.registerQueryHandler('GetUser', getUserHandler);

      const users = userService.listUsers().users;
      const targetUser = users[0];

      if (!targetUser) {
        throw new Error('No users found for test');
      }

      const query: GetUserQuery = {
        type: 'GetUser',
        data: { userId: targetUser.id },
        metadata: {
          id: 'query-1',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
        },
      };

      const result = await eventSystem.executeQuery<
        GetUserQuery,
        UserAggregate | null
      >(query);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(targetUser.id);
      expect(result?.email).toBe(targetUser.email);
    });

    test('should handle list queries with pagination', async () => {
      const listUsersHandler = async (
        query: ListUsersQuery
      ): Promise<{ users: UserAggregate[]; total: number }> => {
        const options: {
          limit?: number;
          offset?: number;
          activeOnly?: boolean;
        } = {};

        if (query.data.limit !== undefined) options.limit = query.data.limit;
        if (query.data.offset !== undefined) options.offset = query.data.offset;
        if (query.data.activeOnly !== undefined)
          options.activeOnly = query.data.activeOnly;

        return userService.listUsers(options);
      };

      eventSystem.registerQueryHandler('ListUsers', listUsersHandler);

      const query: ListUsersQuery = {
        type: 'ListUsers',
        data: { limit: 1, offset: 0 },
        metadata: {
          id: 'query-1',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
        },
      };

      const result = await eventSystem.executeQuery<
        ListUsersQuery,
        { users: UserAggregate[]; total: number }
      >(query);

      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(2);
    });

    test('should throw error for unregistered query', async () => {
      const query: Query<'UnknownQuery', unknown, unknown> = {
        type: 'UnknownQuery',
        data: {},
        metadata: {
          id: 'query-1',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
        },
      };

      await expect(eventSystem.executeQuery(query)).rejects.toThrow(
        'No handler registered for query type: UnknownQuery'
      );
    });
  });

  describe('Event Sourcing Integration', () => {
    test('should save and replay events from aggregate', async () => {
      // Emit a domain event - the event store should automatically persist it
      await eventSystem.emitDomainEvent(
        'UserCreated',
        { userId: 'user-123', name: 'John Doe', email: 'john@example.com' },
        'user-123',
        'User',
        1
      );

      // Wait for event persistence
      await setTimeout(100);

      // Load events for the aggregate
      const events = await eventSystem.loadAggregateEvents('user-123');

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('UserCreated');
      expect(events[0]?.aggregateId).toBe('user-123');
      expect(events[0]?.sequenceNumber).toBe(1);
    });

    test('should handle invalid aggregate IDs gracefully', async () => {
      const events = await eventSystem.loadAggregateEvents('non-existent-id');
      expect(events).toEqual([]);

      const eventsAfterSequence = await eventSystem.loadAggregateEvents(
        'non-existent-id',
        {
          afterSequence: 5,
        }
      );
      expect(eventsAfterSequence).toEqual([]);
    });
  });

  describe('Event Subscriptions and Projections', () => {
    test('should handle event subscriptions for projections', async () => {
      const receivedEvents: DomainEvent[] = [];

      // Subscribe to all user events for a projection
      const eventHandler: EventHandler = async event => {
        if (event.type.startsWith('User')) {
          receivedEvents.push(event as DomainEvent);
        }
      };

      eventSystem.subscribe('*', eventHandler);

      // Set up command handler
      const createUserHandler = async (
        command: CreateUserCommand
      ): Promise<UserAggregate> => {
        return userService.createUser(command.data.email, command.data.name);
      };

      eventSystem.registerCommandHandler('CreateUser', createUserHandler);

      // Execute command
      await eventSystem.executeCommand<CreateUserCommand, UserAggregate>({
        type: 'CreateUser',
        data: { email: 'projection@example.com', name: 'Projection User' },
        metadata: {
          id: 'cmd-1',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
        },
      });

      // Wait for async event handling
      await setTimeout(100);

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]?.type).toBe('UserCreated');
      expect(receivedEvents[0]?.aggregateId).toBeDefined();
    });

    test('should handle multiple projections from same events', async () => {
      const userProjection: DomainEvent[] = [];
      const auditLog: DomainEvent[] = [];

      // Clear arrays to ensure clean state
      userProjection.length = 0;
      auditLog.length = 0;

      // User projection handler
      const userHandler: EventHandler = async event => {
        if (event.type.startsWith('User')) {
          userProjection.push(event as DomainEvent);
        }
      };

      // Audit log handler
      const auditHandler: EventHandler = async event => {
        console.log(
          'Audit handler received event:',
          event.type,
          event.metadata?.id
        );
        auditLog.push(event as DomainEvent);
      };

      eventSystem.subscribe('*', userHandler);
      eventSystem.subscribe('*', auditHandler);

      // Emit a single domain event directly
      await eventSystem.emitDomainEvent(
        'UserCreated',
        {
          userId: 'user-multi',
          name: 'Multi User',
          email: 'multi@example.com',
        },
        'user-multi',
        'User',
        1
      );

      // Wait for async event handling
      await setTimeout(100);

      expect(userProjection).toHaveLength(1); // User events only
      expect(auditLog).toHaveLength(1); // All events
      expect(userProjection[0]?.type).toBe('UserCreated');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle command handler registration conflicts', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventSystem.registerCommandHandler('CreateUser', handler1);

      // Should allow re-registration (overwrites)
      expect(() => {
        eventSystem.registerCommandHandler('CreateUser', handler2);
      }).not.toThrow();
    });

    test('should handle query handler registration conflicts', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventSystem.registerQueryHandler('GetUser', handler1);

      // Should allow re-registration (overwrites)
      expect(() => {
        eventSystem.registerQueryHandler('GetUser', handler2);
      }).not.toThrow();
    });

    test('should handle concurrent command execution', async () => {
      const createUserHandler = async (
        command: CreateUserCommand
      ): Promise<UserAggregate> => {
        // Add small delay to test concurrency
        await setTimeout(5);
        return userService.createUser(command.data.email, command.data.name);
      };

      eventSystem.registerCommandHandler('CreateUser', createUserHandler);

      // Execute multiple commands concurrently
      const commands = Array.from({ length: 5 }, (_, i) =>
        eventSystem.executeCommand<CreateUserCommand, UserAggregate>({
          type: 'CreateUser',
          data: { email: `user${i}@example.com`, name: `User ${i}` },
          metadata: {
            id: `cmd-${i}`,
            timestamp: Date.now(),
            source: 'test',
            version: 1,
          },
        })
      );

      const results = await Promise.all(commands);

      expect(results).toHaveLength(5);
      results.forEach((user, i) => {
        expect(user.email).toBe(`user${i}@example.com`);
        expect(user.name).toBe(`User ${i}`);
      });
    });

    test('should handle event emission errors gracefully', async () => {
      const createUserHandler = async (
        command: CreateUserCommand
      ): Promise<UserAggregate> => {
        const user = await userService.createUser(
          command.data.email,
          command.data.name
        );

        // Force an error in event emission by emitting malformed event
        try {
          await eventSystem.emit({} as never);
        } catch {
          // Expected to fail, but should not affect the command result
        }

        return user;
      };

      eventSystem.registerCommandHandler('CreateUser', createUserHandler);

      const command: CreateUserCommand = {
        type: 'CreateUser',
        data: { email: 'error@example.com', name: 'Error User' },
        metadata: {
          id: 'cmd-1',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
        },
      };

      // Should not throw despite event emission error
      await expect(
        eventSystem.executeCommand<CreateUserCommand, UserAggregate>(command)
      ).resolves.toBeDefined();
    });
  });
});

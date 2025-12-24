/**
 * CQRS Handler for Event System
 *
 * Manages command and query handlers with event emission for monitoring.
 *
 * @packageDocumentation
 */

import { performance } from 'node:perf_hooks';

import type { Command, Event, Query, SystemEvent } from '../../../types/events';
import { SYSTEM_CONSTANTS, SYSTEM_EVENT_TYPES } from '../utils/constants';
import { createEventMetadata } from '../utils/event-helpers';
import type { CommandHandler, QueryHandler, SerializedError } from './types';

/**
 * Event emitter interface for CQRS handler
 */
export interface CQRSEventEmitter {
  emitEvent<T extends Event>(event: T): Promise<void>;
}

/**
 * CQRS (Command Query Responsibility Segregation) handler
 *
 * Manages command and query handlers with:
 * - Handler registration and execution
 * - System event emission for monitoring
 * - Performance tracking
 */
export class CQRSHandler {
  private readonly commandHandlers = new Map<string, CommandHandler<Command>>();
  private readonly queryHandlers = new Map<string, QueryHandler<Query>>();

  constructor(private readonly eventEmitter: CQRSEventEmitter) {}

  // ===========================================================================
  // Command Operations
  // ===========================================================================

  /**
   * Register command handler
   */
  registerCommandHandler<TCommand extends Command, TResult = void>(
    commandType: string,
    handler: CommandHandler<TCommand, TResult>
  ): void {
    this.commandHandlers.set(
      commandType,
      handler as unknown as CommandHandler<Command>
    );
  }

  /**
   * Execute command with monitoring
   */
  async executeCommand<TCommand extends Command, TResult = void>(
    command: TCommand
  ): Promise<TResult> {
    const handler = this.commandHandlers.get(command.type);
    if (!handler) {
      throw new Error(`No handler registered for command type: ${command.type}`);
    }

    const startTime = performance.now();

    try {
      await this.emitSystemEvent(SYSTEM_EVENT_TYPES.COMMAND_STARTED, {
        commandType: command.type,
        commandId: command.metadata.id,
        correlationId: command.metadata.correlationId,
        source: command.metadata.source,
      });

      const result = await Promise.resolve(handler(command as never));

      await this.emitSystemEvent(SYSTEM_EVENT_TYPES.COMMAND_COMPLETED, {
        commandType: command.type,
        commandId: command.metadata.id,
        correlationId: command.metadata.correlationId,
        executionTime: performance.now() - startTime,
      });

      return result as TResult;
    } catch (error) {
      await this.emitSystemEvent(SYSTEM_EVENT_TYPES.COMMAND_FAILED, {
        commandType: command.type,
        commandId: command.metadata.id,
        correlationId: command.metadata.correlationId,
        error: this.serializeError(error),
        executionTime: performance.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Check if command handler is registered
   */
  hasCommandHandler(commandType: string): boolean {
    return this.commandHandlers.has(commandType);
  }

  // ===========================================================================
  // Query Operations
  // ===========================================================================

  /**
   * Register query handler
   */
  registerQueryHandler<TQuery extends Query, TResult = unknown>(
    queryType: string,
    handler: QueryHandler<TQuery, TResult>
  ): void {
    this.queryHandlers.set(
      queryType,
      handler as unknown as QueryHandler<Query>
    );
  }

  /**
   * Execute query with monitoring
   */
  async executeQuery<TQuery extends Query, TResult = unknown>(
    query: TQuery
  ): Promise<TResult> {
    const handler = this.queryHandlers.get(query.type);
    if (!handler) {
      throw new Error(`No handler registered for query type: ${query.type}`);
    }

    const startTime = performance.now();

    try {
      await this.emitSystemEvent(SYSTEM_EVENT_TYPES.QUERY_STARTED, {
        queryType: query.type,
        queryId: query.metadata.id,
        correlationId: query.metadata.correlationId,
        source: query.metadata.source,
      });

      const result = await Promise.resolve(handler(query as never));

      await this.emitSystemEvent(SYSTEM_EVENT_TYPES.QUERY_COMPLETED, {
        queryType: query.type,
        queryId: query.metadata.id,
        correlationId: query.metadata.correlationId,
        executionTime: performance.now() - startTime,
      });

      return result as TResult;
    } catch (error) {
      await this.emitSystemEvent(SYSTEM_EVENT_TYPES.QUERY_FAILED, {
        queryType: query.type,
        queryId: query.metadata.id,
        correlationId: query.metadata.correlationId,
        error: this.serializeError(error),
        executionTime: performance.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Check if query handler is registered
   */
  hasQueryHandler(queryType: string): boolean {
    return this.queryHandlers.has(queryType);
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Clear all handlers
   */
  clear(): void {
    this.commandHandlers.clear();
    this.queryHandlers.clear();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private async emitSystemEvent(
    type: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const systemEvent: SystemEvent = {
      type,
      data,
      metadata: createEventMetadata({
        source: SYSTEM_CONSTANTS.SYSTEM_SOURCE,
      }),
      component: 'event-system',
      level: SYSTEM_CONSTANTS.DEFAULT_LOG_LEVEL,
    };

    await this.eventEmitter.emitEvent(systemEvent);
  }

  private serializeError(error: unknown): SerializedError {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return { message: String(error) };
  }
}

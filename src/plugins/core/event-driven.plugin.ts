/**
 * 🔄 Event-Driven Architecture Plugin - NextRush Framework
 *
 * Provides comprehensive event-driven capabilities with pub/sub patterns,
 * event sourcing, and reactive programming features.
 */

import { Application } from '../../core/app/application';
import { SimpleEventEmitter } from '../../core/event-system';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

/**
 * Event listener with metadata
 */
interface EventListener {
  id: string;
  event: string;
  handler: (...args: any[]) => void | Promise<void>;
  once?: boolean;
  priority?: number;
  created: Date;
}

/**
 * Event middleware options
 */
interface EventMiddlewareOptions {
  autoEmit?: boolean;
  events?: string[];
  includeRequest?: boolean;
  includeResponse?: boolean;
}

/**
 * Event pipeline configuration
 */
interface EventPipeline {
  name: string;
  events: string[];
  handler: (eventData: any) => void | Promise<void>;
  filters?: Array<(data: any) => boolean>;
}

/**
 * 🔄 Event-Driven Architecture Plugin
 */
export class EventDrivenPlugin extends BasePlugin {
  name = 'EventDriven';

  private eventEmitter: SimpleEventEmitter;
  private listeners: Map<string, EventListener[]>;
  private pipelines: Map<string, EventPipeline>;
  private eventHistory: Array<{ event: string; data: any; timestamp: Date }>;
  private maxHistorySize: number = 1000;

  constructor(registry: PluginRegistry) {
    super(registry);
    this.eventEmitter = new SimpleEventEmitter();
    this.listeners = new Map();
    this.pipelines = new Map();
    this.eventHistory = [];
  }

  /**
   * Install event-driven capabilities
   */
  install(app: Application): void {
    // Add event emitter to app
    (app as any).events = this.eventEmitter;

    // Add event management methods
    (app as any).on = this.addEventListener.bind(this);
    (app as any).once = this.addEventListenerOnce.bind(this);
    (app as any).off = this.removeEventListener.bind(this);
    (app as any).emit = this.emitEvent.bind(this);

    // Add event pipeline methods
    (app as any).pipeline = this.createPipeline.bind(this);
    (app as any).trigger = this.triggerPipeline.bind(this);

    // Add event middleware
    (app as any).eventMiddleware = this.createEventMiddleware.bind(this);

    // Add event querying
    (app as any).getEventHistory = () => this.eventHistory.slice();
    (app as any).getEventStats = this.getEventStats.bind(this);

    // Automatic request/response events
    app.use((req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const self = this;

      // Emit request start event
      self.emitEvent('request:start', {
        id: self.generateId(),
        method: req.method,
        url: req.url,
        headers: req.headers,
        timestamp: new Date(),
        ip: req.ip?.() || 'unknown',
      });

      // Track response end
      const originalEnd = res.end.bind(res);
      (res as any).end = function (
        chunk?: any,
        encoding?: BufferEncoding,
        cb?: () => void
      ): NextRushResponse {
        // Emit response end event
        self.emitEvent('request:end', {
          statusCode: res.statusCode,
          headers: res.getHeaders(),
          timestamp: new Date(),
        });

        return originalEnd(chunk, encoding as any, cb);
      };

      next();
    });

    this.emit('eventDriven:installed');
  }

  /**
   * Start the event-driven plugin
   */
  start(): void {
    this.emit('eventDriven:started');
  }

  /**
   * Stop the event-driven plugin
   */
  stop(): void {
    this.listeners.clear();
    this.pipelines.clear();
    this.eventHistory = [];
    this.emit('eventDriven:stopped');
  }

  /**
   * 📢 Add event listener
   */
  addEventListener(
    event: string,
    handler: (...args: any[]) => void | Promise<void>,
    options?: { priority?: number }
  ): string {
    const listener: EventListener = {
      id: this.generateId(),
      event,
      handler,
      priority: options?.priority || 0,
      created: new Date(),
    };

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const eventListeners = this.listeners.get(event)!;
    eventListeners.push(listener);

    // Sort by priority (higher first)
    eventListeners.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Register with internal emitter
    this.eventEmitter.on(event, handler);

    this.emitEvent('listener:added', { event, listenerId: listener.id });

    return listener.id;
  }

  /**
   * 📢 Add one-time event listener
   */
  addEventListenerOnce(
    event: string,
    handler: (...args: any[]) => void | Promise<void>
  ): string {
    const listenerId = this.generateId();

    const wrapper = (...args: any[]) => {
      handler(...args);
      this.removeEventListener(event, listenerId);
    };

    const listener: EventListener = {
      id: listenerId,
      event,
      handler: wrapper,
      once: true,
      created: new Date(),
    };

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event)!.push(listener);
    this.eventEmitter.on(event, wrapper);

    return listenerId;
  }

  /**
   * 🚫 Remove event listener
   */
  removeEventListener(event: string, listenerId?: string): boolean {
    if (!this.listeners.has(event)) {
      return false;
    }

    const eventListeners = this.listeners.get(event)!;

    if (listenerId) {
      const index = eventListeners.findIndex((l) => l.id === listenerId);
      if (index !== -1) {
        const listener = eventListeners[index];
        this.eventEmitter.off(event, listener.handler);
        eventListeners.splice(index, 1);

        this.emitEvent('listener:removed', { event, listenerId });
        return true;
      }
    } else {
      // Remove all listeners for event
      eventListeners.forEach((listener) => {
        this.eventEmitter.off(event, listener.handler);
      });
      this.listeners.delete(event);

      this.emitEvent('listeners:cleared', { event });
      return true;
    }

    return false;
  }

  /**
   * 📡 Emit event
   */
  emitEvent(event: string, data?: any): void {
    // Add to history
    this.addToHistory(event, data);

    // Emit through internal emitter
    this.eventEmitter.emit(event, data);

    // Check pipelines
    this.triggerPipelinesForEvent(event, data);
  }

  /**
   * 🔧 Create event pipeline
   */
  createPipeline(name: string, config: Omit<EventPipeline, 'name'>): void {
    const pipeline: EventPipeline = {
      name,
      ...config,
    };

    this.pipelines.set(name, pipeline);

    this.emitEvent('pipeline:created', { name, events: config.events });
  }

  /**
   * ⚡ Trigger specific pipeline
   */
  triggerPipeline(name: string, data?: any): void {
    const pipeline = this.pipelines.get(name);
    if (!pipeline) {
      throw new Error(`Pipeline '${name}' not found`);
    }

    // Apply filters if any
    if (pipeline.filters && pipeline.filters.length > 0) {
      const passesFilters = pipeline.filters.every((filter) => filter(data));
      if (!passesFilters) {
        return;
      }
    }

    // Execute pipeline handler
    const result = pipeline.handler(data);

    this.emitEvent('pipeline:triggered', { name, data });

    // Handle async pipelines
    if (result instanceof Promise) {
      result.catch((error) => {
        this.emitEvent('pipeline:error', { name, error: error.message, data });
      });
    }
  }

  /**
   * 🔧 Create event middleware
   */
  createEventMiddleware(options: EventMiddlewareOptions = {}) {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      if (options.autoEmit) {
        const eventData: any = { timestamp: new Date() };

        if (options.includeRequest) {
          eventData.request = {
            method: req.method,
            url: req.url,
            headers: req.headers,
          };
        }

        if (options.includeResponse) {
          eventData.response = {
            statusCode: res.statusCode,
            headers: res.getHeaders(),
          };
        }

        // Emit configured events
        if (options.events) {
          options.events.forEach((event) => {
            this.emitEvent(event, eventData);
          });
        }
      }

      next();
    };
  }

  /**
   * 📊 Get event statistics
   */
  getEventStats(): any {
    const stats: any = {
      totalEvents: this.eventHistory.length,
      listeners: {},
      pipelines: this.pipelines.size,
      recentEvents: this.eventHistory.slice(-10),
    };

    // Count listeners by event
    const listenersEntries = Array.from(this.listeners.entries());
    for (const [event, listeners] of listenersEntries) {
      stats.listeners[event] = listeners.length;
    }

    return stats;
  }

  /**
   * 📝 Add event to history
   */
  private addToHistory(event: string, data: any): void {
    this.eventHistory.push({
      event,
      data,
      timestamp: new Date(),
    });

    // Trim history if needed
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * ⚡ Trigger pipelines for event
   */
  private triggerPipelinesForEvent(event: string, data: any): void {
    const pipelineValues = Array.from(this.pipelines.values());
    for (const pipeline of pipelineValues) {
      if (pipeline.events.includes(event)) {
        try {
          this.triggerPipeline(pipeline.name, data);
        } catch (error) {
          this.emitEvent('pipeline:error', {
            name: pipeline.name,
            error: error instanceof Error ? error.message : String(error),
            event,
            data,
          });
        }
      }
    }
  }

  /**
   * 🔧 Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

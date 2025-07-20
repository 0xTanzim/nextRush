/**
 * 🚀 NextRush Simple Event System
 * Lightweight event-driven architecture for request/response tracking
 */

export type EventCallback<T = any> = (data: T) => void | Promise<void>;

export interface EventData {
  timestamp: number;
  id: string;
}

export interface RequestEventData extends EventData {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  userAgent?: string;
}

export interface ResponseEventData extends EventData {
  statusCode: number;
  headers: Record<string, string | string[] | number | undefined>;
  responseTime: number;
  requestId: string;
}

export interface ErrorEventData extends EventData {
  error: Error;
  requestId?: string;
  context?: any;
}

/**
 * 🎯 Simple Event Emitter
 */
export class SimpleEventEmitter {
  private events = new Map<string, EventCallback[]>();
  private maxListeners = 10;

  /**
   * Add event listener
   */
  on<T = any>(event: string, callback: EventCallback<T>): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }

    const listeners = this.events.get(event)!;

    if (listeners.length >= this.maxListeners) {
      console.warn(
        `MaxListenersExceededWarning: Possible memory leak detected. ${
          listeners.length + 1
        } ${event} listeners added.`
      );
    }

    listeners.push(callback);
    return this;
  }

  /**
   * Add one-time event listener
   */
  once<T = any>(event: string, callback: EventCallback<T>): this {
    const onceWrapper = (data: T) => {
      this.off(event, onceWrapper);
      callback(data);
    };

    return this.on(event, onceWrapper);
  }

  /**
   * Remove event listener
   */
  off<T = any>(event: string, callback: EventCallback<T>): this {
    const listeners = this.events.get(event);
    if (!listeners) return this;

    const index = listeners.indexOf(callback);
    if (index !== -1) {
      listeners.splice(index, 1);
    }

    if (listeners.length === 0) {
      this.events.delete(event);
    }

    return this;
  }

  /**
   * Remove all listeners for event or all events
   */
  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  /**
   * Emit event
   */
  emit<T = any>(event: string, data?: T): boolean {
    const listeners = this.events.get(event);
    if (!listeners || listeners.length === 0) {
      return false;
    }

    // Execute all listeners
    for (const listener of listeners) {
      try {
        const result = listener(data);
        // Handle async listeners
        if (result && typeof result.then === 'function') {
          result.catch((error: Error) => {
            console.error(
              `Error in async event listener for '${event}':`,
              error
            );
          });
        }
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error);
      }
    }

    return true;
  }

  /**
   * Get listener count for event
   */
  listenerCount(event: string): number {
    const listeners = this.events.get(event);
    return listeners ? listeners.length : 0;
  }

  /**
   * Get all event names
   */
  eventNames(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * Get listeners for event
   */
  listeners<T = any>(event: string): EventCallback<T>[] {
    return this.events.get(event) ? [...this.events.get(event)!] : [];
  }

  /**
   * Set max listeners
   */
  setMaxListeners(max: number): this {
    this.maxListeners = max;
    return this;
  }

  /**
   * Get max listeners
   */
  getMaxListeners(): number {
    return this.maxListeners;
  }
}

/**
 * 🎪 Application Event System
 * Global event system for the NextRush application
 */
export class ApplicationEventSystem extends SimpleEventEmitter {
  private requestCounter = 0;

  constructor() {
    super();
    this.setMaxListeners(50); // Higher limit for application events
  }

  /**
   * Generate unique request ID
   */
  generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestCounter}`;
  }

  /**
   * Emit request start event
   */
  emitRequestStart(data: Omit<RequestEventData, 'id' | 'timestamp'>): string {
    const requestId = this.generateRequestId();
    const eventData: RequestEventData = {
      ...data,
      id: requestId,
      timestamp: Date.now(),
    };

    this.emit('request:start', eventData);
    this.emit('request', eventData);
    return requestId;
  }

  /**
   * Emit request end event
   */
  emitRequestEnd(data: Omit<ResponseEventData, 'timestamp'>): void {
    const eventData: ResponseEventData = {
      ...data,
      timestamp: Date.now(),
    };

    this.emit('request:end', eventData);
    this.emit('response', eventData);
  }

  /**
   * Emit error event
   */
  emitError(error: Error, requestId?: string, context?: any): void {
    const baseData = {
      error,
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    const eventData: ErrorEventData = requestId
      ? { ...baseData, requestId, context }
      : { ...baseData, context };

    this.emit('error', eventData);
    if (requestId) {
      this.emit('request:error', eventData);
    }
  }

  /**
   * Emit application start event
   */
  emitAppStart(data: { port: number; host?: string; pid: number }): void {
    this.emit('app:start', {
      ...data,
      timestamp: Date.now(),
      id: `app_start_${Date.now()}`,
    });
  }

  /**
   * Emit application stop event
   */
  emitAppStop(): void {
    this.emit('app:stop', {
      timestamp: Date.now(),
      id: `app_stop_${Date.now()}`,
    });
  }

  /**
   * Emit middleware event
   */
  emitMiddleware(name: string, requestId: string, duration?: number): void {
    this.emit('middleware', {
      name,
      requestId,
      duration,
      timestamp: Date.now(),
      id: `mw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });
  }

  /**
   * Emit route match event
   */
  emitRouteMatch(route: string, method: string, requestId: string): void {
    this.emit('route:match', {
      route,
      method,
      requestId,
      timestamp: Date.now(),
      id: `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });
  }
}

/**
 * 🎭 Built-in Event Listeners
 */
export class EventListeners {
  /**
   * Basic request logger
   */
  static requestLogger(data: RequestEventData): void {
    console.log(
      `[${new Date(data.timestamp).toISOString()}] ${data.method} ${
        data.url
      } - ${data.ip || 'unknown'}`
    );
  }

  /**
   * Basic response logger
   */
  static responseLogger(data: ResponseEventData): void {
    const color =
      data.statusCode >= 400
        ? '\x1b[31m'
        : data.statusCode >= 300
        ? '\x1b[33m'
        : '\x1b[32m';
    const reset = '\x1b[0m';
    console.log(
      `[${new Date(data.timestamp).toISOString()}] ${color}${
        data.statusCode
      }${reset} - ${data.responseTime}ms`
    );
  }

  /**
   * Error logger
   */
  static errorLogger(data: ErrorEventData): void {
    console.error(
      `[${new Date(data.timestamp).toISOString()}] ERROR:`,
      data.error.message
    );
    if (data.requestId) {
      console.error(`Request ID: ${data.requestId}`);
    }
    if (data.error.stack) {
      console.error(data.error.stack);
    }
  }

  /**
   * Performance monitor
   */
  static performanceMonitor(data: ResponseEventData): void {
    if (data.responseTime > 1000) {
      console.warn(
        `[PERFORMANCE] Slow request detected: ${data.responseTime}ms (Request ID: ${data.requestId})`
      );
    }
  }

  /**
   * Security monitor
   */
  static securityMonitor(data: RequestEventData): void {
    const suspiciousPatterns = [
      /\.\.\//, // Directory traversal
      /<script/i, // XSS attempts
      /union.*select/i, // SQL injection
      /exec\(/i, // Code injection
    ];

    const url = data.url.toLowerCase();
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url)) {
        console.warn(
          `[SECURITY] Suspicious request detected from ${data.ip}: ${data.method} ${data.url}`
        );
        break;
      }
    }
  }

  /**
   * Rate limiting monitor
   */
  static rateLimitMonitor = (() => {
    const requestCounts = new Map<
      string,
      { count: number; resetTime: number }
    >();

    return (data: RequestEventData): void => {
      const ip = data.ip || 'unknown';
      const now = Date.now();
      const windowMs = 60000; // 1 minute
      const maxRequests = 100;

      let clientData = requestCounts.get(ip);
      if (!clientData || now >= clientData.resetTime) {
        clientData = { count: 0, resetTime: now + windowMs };
      }

      clientData.count++;
      requestCounts.set(ip, clientData);

      if (clientData.count > maxRequests) {
        console.warn(
          `[RATE_LIMIT] Rate limit exceeded for IP ${ip}: ${clientData.count} requests in window`
        );
      }
    };
  })();
}

/**
 * Create a new event system instance
 */
export function createEventSystem(): ApplicationEventSystem {
  return new ApplicationEventSystem();
}

/**
 * Create a simple event emitter
 */
export function createEventEmitter(): SimpleEventEmitter {
  return new SimpleEventEmitter();
}

/**
 * Global event system instance
 */
export const globalEventSystem = new ApplicationEventSystem();

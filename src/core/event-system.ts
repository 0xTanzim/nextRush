/**
 * Simple Event System for NextRush (OPTIONAL FEATURE)
 * Provides basic event tracking - can be disabled if not needed
 */

import { EventEmitter } from 'events';
import { IncomingMessage, ServerResponse } from 'http';

export interface SimpleEventData {
  id: string;
  method: string;
  url: string;
  timestamp: number;
  userAgent?: string;
  ip?: string;
}

export interface ResponseEventData extends SimpleEventData {
  statusCode: number;
  duration: number;
}

export interface ErrorEventData extends SimpleEventData {
  error: Error;
}

/**
 * Simple Event Emitter - OPTIONAL feature for NextRush
 * If you don't need events, you can ignore this completely
 */
export class SimpleEventEmitter extends EventEmitter {
  private requestCount = 0;
  private startTime = Date.now();
  private enabled = true;

  constructor(enabled = true) {
    super();
    this.enabled = enabled;
  }

  /**
   * Enable or disable event tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if events are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Emit request start (only if enabled)
   */
  emitRequestStart(req: IncomingMessage): string {
    if (!this.enabled) return '';

    const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.requestCount++;

    this.emit('request:start', {
      id,
      method: req.method || 'GET',
      url: req.url || '/',
      timestamp: Date.now(),
      userAgent: req.headers['user-agent'],
      ip:
        (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
    } as SimpleEventData);

    return id;
  }

  /**
   * Emit request end (only if enabled)
   */
  emitRequestEnd(
    req: IncomingMessage,
    res: ServerResponse,
    requestId: string,
    startTime: number
  ): void {
    if (!this.enabled) return;

    this.emit('request:end', {
      id: requestId,
      method: req.method || 'GET',
      url: req.url || '/',
      timestamp: Date.now(),
      statusCode: res.statusCode,
      duration: Date.now() - startTime,
      userAgent: req.headers['user-agent'],
      ip:
        (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
    } as ResponseEventData);
  }

  /**
   * Emit error (only if enabled)
   */
  emitError(req: IncomingMessage, error: Error, requestId: string): void {
    if (!this.enabled) return;

    this.emit('error', {
      id: requestId,
      method: req.method || 'GET',
      url: req.url || '/',
      timestamp: Date.now(),
      error,
      userAgent: req.headers['user-agent'],
      ip:
        (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
    } as ErrorEventData);
  }

  /**
   * Get basic statistics (only if enabled)
   */
  getStats() {
    if (!this.enabled) {
      return {
        enabled: false,
        message: 'Event tracking is disabled',
      };
    }

    return {
      enabled: true,
      totalRequests: this.requestCount,
      uptime: Date.now() - this.startTime,
    };
  }
}

/**
 * Simple development logging (OPTIONAL)
 */
export function enableSimpleLogging(events: SimpleEventEmitter): void {
  if (!events.isEnabled()) return;

  events.on('request:start', (data: SimpleEventData) => {
    console.log(`🚀 ${data.method} ${data.url}`);
  });

  events.on('request:end', (data: ResponseEventData) => {
    const icon = data.statusCode >= 400 ? '❌' : '✅';
    console.log(
      `${icon} ${data.method} ${data.url} - ${data.statusCode} (${data.duration}ms)`
    );
  });

  events.on('error', (data: ErrorEventData) => {
    console.error(`💥 Error: ${data.error.message}`);
  });
}

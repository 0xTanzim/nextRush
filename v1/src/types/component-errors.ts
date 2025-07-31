/**
 * 🔧 Component Error Types - SOLID Error Handling
 * Proper error types for component architecture
 */

/**
 * Base error interface for all component errors
 */
export interface ComponentError extends Error {
  readonly component: string;
  readonly code: string;
  readonly statusCode?: number;
  readonly context?: Record<string, unknown>;
}

/**
 * Router component specific errors
 */
export interface RouterError extends ComponentError {
  readonly component: 'Router';
  readonly method?: string;
  readonly path?: string;
}

/**
 * Template component specific errors
 */
export interface TemplateError extends ComponentError {
  readonly component: 'Template';
  readonly template?: string;
  readonly engine?: string;
}

/**
 * WebSocket component specific errors
 */
export interface WebSocketError extends ComponentError {
  readonly component: 'WebSocket';
  readonly connectionId?: string;
  readonly event?: string;
}

/**
 * Static files component specific errors
 */
export interface StaticFilesError extends ComponentError {
  readonly component: 'StaticFiles';
  readonly filePath?: string;
  readonly mimeType?: string;
}

/**
 * Union type for all component errors
 */
export type AnyComponentError =
  | RouterError
  | TemplateError
  | WebSocketError
  | StaticFilesError;

/**
 * Error factory for creating typed errors
 */
export class ComponentErrorFactory {
  static createRouterError(
    message: string,
    code: string,
    context?: { method?: string; path?: string; statusCode?: number }
  ): RouterError {
    return new RouterErrorImpl(message, code, context);
  }

  static createTemplateError(
    message: string,
    code: string,
    context?: { template?: string; engine?: string; statusCode?: number }
  ): TemplateError {
    return new TemplateErrorImpl(message, code, context);
  }

  static createWebSocketError(
    message: string,
    code: string,
    context?: { connectionId?: string; event?: string; statusCode?: number }
  ): WebSocketError {
    return new WebSocketErrorImpl(message, code, context);
  }

  static createStaticFilesError(
    message: string,
    code: string,
    context?: { filePath?: string; mimeType?: string; statusCode?: number }
  ): StaticFilesError {
    return new StaticFilesErrorImpl(message, code, context);
  }
}

/**
 * Router error implementation
 */
class RouterErrorImpl extends Error implements RouterError {
  readonly component = 'Router' as const;
  readonly code: string;
  readonly statusCode?: number;
  readonly context?: Record<string, unknown>;
  readonly method?: string;
  readonly path?: string;

  constructor(
    message: string,
    code: string,
    context?: { method?: string; path?: string; statusCode?: number }
  ) {
    super(message);
    this.name = 'RouterError';
    this.code = code;
    if (context?.method !== undefined) this.method = context.method;
    if (context?.path !== undefined) this.path = context.path;
    if (context?.statusCode !== undefined) this.statusCode = context.statusCode;
    if (context !== undefined)
      this.context = context as Record<string, unknown>;
  }
}

/**
 * Template error implementation
 */
class TemplateErrorImpl extends Error implements TemplateError {
  readonly component = 'Template' as const;
  readonly code: string;
  readonly statusCode?: number;
  readonly context?: Record<string, unknown>;
  readonly template?: string;
  readonly engine?: string;

  constructor(
    message: string,
    code: string,
    context?: { template?: string; engine?: string; statusCode?: number }
  ) {
    super(message);
    this.name = 'TemplateError';
    this.code = code;
    if (context?.template !== undefined) this.template = context.template;
    if (context?.engine !== undefined) this.engine = context.engine;
    if (context?.statusCode !== undefined) this.statusCode = context.statusCode;
    if (context !== undefined)
      this.context = context as Record<string, unknown>;
  }
}

/**
 * WebSocket error implementation
 */
class WebSocketErrorImpl extends Error implements WebSocketError {
  readonly component = 'WebSocket' as const;
  readonly code: string;
  readonly statusCode?: number;
  readonly context?: Record<string, unknown>;
  readonly connectionId?: string;
  readonly event?: string;

  constructor(
    message: string,
    code: string,
    context?: { connectionId?: string; event?: string; statusCode?: number }
  ) {
    super(message);
    this.name = 'WebSocketError';
    this.code = code;
    if (context?.connectionId !== undefined)
      this.connectionId = context.connectionId;
    if (context?.event !== undefined) this.event = context.event;
    if (context?.statusCode !== undefined) this.statusCode = context.statusCode;
    if (context !== undefined)
      this.context = context as Record<string, unknown>;
  }
}

/**
 * Static files error implementation
 */
class StaticFilesErrorImpl extends Error implements StaticFilesError {
  readonly component = 'StaticFiles' as const;
  readonly code: string;
  readonly statusCode?: number;
  readonly context?: Record<string, unknown>;
  readonly filePath?: string;
  readonly mimeType?: string;

  constructor(
    message: string,
    code: string,
    context?: { filePath?: string; mimeType?: string; statusCode?: number }
  ) {
    super(message);
    this.name = 'StaticFilesError';
    this.code = code;
    if (context?.filePath !== undefined) this.filePath = context.filePath;
    if (context?.mimeType !== undefined) this.mimeType = context.mimeType;
    if (context?.statusCode !== undefined) this.statusCode = context.statusCode;
    if (context !== undefined)
      this.context = context as Record<string, unknown>;
  }
}

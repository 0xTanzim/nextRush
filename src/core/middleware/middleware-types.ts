/**
 * Core middleware types for NextRush
 */

export interface NextFunction {
  (): void;
}

export interface MiddlewareHandler {
  (req: any, res: any, next?: NextFunction): void;
}

export interface MiddlewareOptions {
  [key: string]: any;
}

import { Router } from './lib/Router';
import { Server, ServerOptions } from './lib/Server';
import { Handler, Path, Request, Response } from './types';

export class NextRush extends Server {
  constructor(options?: ServerOptions) {
    super(options);
  }

  // Static Router access like Express.js
  static Router(options?: import('./lib/Router').RouterOptions): Router {
    return new Router(options);
  }
}

// Re-export types and Router for convenience
export { Router };
export type { Handler, Path, Request, Response, ServerOptions };

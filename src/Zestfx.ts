import { Server, ServerOptions } from './lib/Server';
import { Handler, Path, Request, Response } from './types';

export class Zestfx extends Server {
  constructor(options?: ServerOptions) {
    super(options);
  }
}

// Re-export types for convenience
export type { Handler, Path, Request, Response, ServerOptions };

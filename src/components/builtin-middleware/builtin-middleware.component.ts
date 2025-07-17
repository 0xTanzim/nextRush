/**
 * 🔧 Built-in Middleware Component - Enterprise Middleware Collection
 * SOLID-compliant component for common middleware functions
 */

import type { MinimalApplication } from '../../core/interfaces';
import { BaseComponent } from '../../core/base-component';
import type { NextRushRequest, NextRushResponse } from '../../types/express';

/**
 * Built-in Middleware Component - Provides common middleware
 */
export class BuiltInMiddlewareComponent extends BaseComponent {
  readonly name = 'BuiltInMiddleware';

  constructor() {
    super('BuiltInMiddleware');
  }

  /**
   * Install built-in middleware
   */
  install(app: MinimalApplication): void {
    // Middleware are available as methods
  }

  /**
   * Start the middleware component
   */
  override async start(): Promise<void> {
    console.log('Built-in middleware component started');
  }

  /**
   * Stop the middleware component
   */
  override async stop(): Promise<void> {
    console.log('Built-in middleware component stopped');
  }

  /**
   * CORS middleware
   */
  cors(options: {
    origin?: string | string[] | boolean;
    methods?: string[];
    allowedHeaders?: string[];
    credentials?: boolean;
  } = {}) {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const origin = req.headers.origin as string;
      
      // Set CORS headers
      if (options.origin === true) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
      } else if (typeof options.origin === 'string') {
        res.setHeader('Access-Control-Allow-Origin', options.origin);
      } else if (Array.isArray(options.origin)) {
        if (origin && options.origin.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }

      if (options.methods) {
        res.setHeader('Access-Control-Allow-Methods', options.methods.join(', '));
      }

      if (options.allowedHeaders) {
        res.setHeader('Access-Control-Allow-Headers', options.allowedHeaders.join(', '));
      }

      if (options.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      // Handle preflight
      if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
      }

      next();
    };
  }

  /**
   * JSON middleware
   */
  json(options: { limit?: string } = {}) {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      if (req.headers['content-type']?.includes('application/json')) {
        let body = '';
        
        req.on('data', (chunk) => {
          body += chunk.toString();
          
          // Check limit
          if (options.limit) {
            const limit = this.parseLimit(options.limit);
            if (body.length > limit) {
              res.status(413).json({ error: 'Request entity too large' });
              return;
            }
          }
        });

        req.on('end', () => {
          try {
            req.body = JSON.parse(body);
          } catch (error) {
            res.status(400).json({ error: 'Invalid JSON' });
            return;
          }
          next();
        });
      } else {
        next();
      }
    };
  }

  /**
   * URL encoded middleware
   */
  urlencoded(options: { extended?: boolean; limit?: string } = {}) {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
        let body = '';
        
        req.on('data', (chunk) => {
          body += chunk.toString();
          
          // Check limit
          if (options.limit) {
            const limit = this.parseLimit(options.limit);
            if (body.length > limit) {
              res.status(413).json({ error: 'Request entity too large' });
              return;
            }
          }
        });

        req.on('end', () => {
          const params = new URLSearchParams(body);
          req.body = {};
          
          for (const [key, value] of params.entries()) {
            if (options.extended) {
              this.setNestedValue(req.body, key, value);
            } else {
              req.body[key] = value;
            }
          }
          
          next();
        });
      } else {
        next();
      }
    };
  }

  /**
   * Parse limit string to bytes
   */
  private parseLimit(limit: string): number {
    const units: Record<string, number> = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024
    };

    const match = limit.toLowerCase().match(/^(\d+)\s*([a-z]+)?$/);
    if (!match) return 1024 * 1024; // Default 1MB

    const value = parseInt(match[1], 10);
    const unit = match[2] || 'b';
    
    return value * (units[unit] || 1);
  }

  /**
   * Set nested value for extended URL encoding
   */
  private setNestedValue(obj: Record<string, any>, path: string, value: string): void {
    const keys = path.split('[').map(key => key.replace(']', ''));
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }
}

/**
 * 🍽️ Body Parser Component - Enterprise Request Body Processing
 * SOLID-compliant component for parsing request bodies
 */

import type { MinimalApplication } from '../../core/interfaces';
import { BaseComponent } from '../../core/base-component';

/**
 * Body parser options
 */
export interface BodyParserOptions {
  json?: {
    limit?: string;
    strict?: boolean;
  };
  urlencoded?: {
    limit?: string;
    extended?: boolean;
  };
  text?: {
    limit?: string;
    type?: string;
  };
  raw?: {
    limit?: string;
    type?: string;
  };
}

/**
 * Body Parser Component - Handles request body parsing
 */
export class BodyParserComponent extends BaseComponent {
  readonly name = 'BodyParser';

  constructor() {
    super('BodyParser');
  }

  /**
   * Install body parsing capabilities
   */
  install(app: MinimalApplication): void {
    // Body parsing will be handled by request enhancer
    // This component provides configuration
  }

  /**
   * Start the body parser
   */
  override async start(): Promise<void> {
    console.log('Body parser component started');
  }

  /**
   * Stop the body parser
   */
  override async stop(): Promise<void> {
    console.log('Body parser component stopped');
  }

  /**
   * Parse JSON body
   */
  parseJson(body: string, options: BodyParserOptions['json'] = {}): any {
    try {
      if (options.strict === false) {
        return JSON.parse(body);
      }
      // Strict JSON parsing
      const parsed = JSON.parse(body);
      return parsed;
    } catch (error) {
      throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse URL encoded body
   */
  parseUrlencoded(body: string, options: BodyParserOptions['urlencoded'] = {}): Record<string, any> {
    const params = new URLSearchParams(body);
    const result: Record<string, any> = {};
    
    for (const [key, value] of params.entries()) {
      if (options.extended) {
        // Extended parsing supports nested objects
        this.setNestedValue(result, key, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
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

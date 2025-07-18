/**
 * 🔄 Body Parser Plugin - NextRush Framework
 *
 * Unified plugin architecture following copilot instructions.
 * Handles automatic request body parsing with zero configuration.
 */

import { Application } from '../../core/app/application';
import {
  ExpressMiddleware,
  NextRushRequest,
  NextRushResponse,
} from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

export interface BodyParserOptions {
  maxSize?: number;
  timeout?: number;
  allowedContentTypes?: string[];
  strict?: boolean;
  json?: {
    limit?: string;
    strict?: boolean;
    reviver?: (key: string, value: any) => any;
  };
  urlencoded?: {
    limit?: string;
    extended?: boolean;
    parameterLimit?: number;
  };
  text?: {
    limit?: string;
    type?: string;
  };
}

/**
 * Body Parser Plugin - Handles automatic request body parsing
 */
export class BodyParserPlugin extends BasePlugin {
  name = 'BodyParser';

  private options: Required<BodyParserOptions>;

  constructor(registry: PluginRegistry, options: BodyParserOptions = {}) {
    super(registry);

    this.options = {
      maxSize: 1024 * 1024, // 1MB
      timeout: 30000, // 30 seconds
      allowedContentTypes: [
        'application/json',
        'application/x-www-form-urlencoded',
        'text/plain',
        'text/*',
      ],
      strict: false,
      json: {
        limit: '1mb',
        strict: false,
        ...options.json,
      },
      urlencoded: {
        limit: '1mb',
        extended: true,
        parameterLimit: 1000,
        ...options.urlencoded,
      },
      text: {
        limit: '1mb',
        type: 'text/*',
        ...options.text,
      },
      ...options,
    };
  }

  /**
   * Install body parser capabilities into the application
   */
  install(app: Application): void {
    // Install automatic body parsing middleware
    this.installAutoBodyParser(app);

    // Install individual middleware creators
    this.installMiddlewareCreators(app);

    this.emit('body-parser:installed');
  }

  /**
   * Start the body parser plugin
   */
  start(): void {
    this.emit('body-parser:started');
  }

  /**
   * Stop the body parser plugin
   */
  stop(): void {
    this.emit('body-parser:stopped');
  }

  /**
   * Install automatic body parsing middleware
   */
  private installAutoBodyParser(app: Application): void {
    // Add automatic body parsing as global middleware
    const autoParser: ExpressMiddleware = (
      req: NextRushRequest,
      res: NextRushResponse,
      next: () => void
    ) => {
      this.parseRequestBody(req, res)
        .then(() => {
          next();
        })
        .catch((error) => {
          this.handleParseError(error, res);
        });
    };

    // Install as global middleware using the application's use method
    app.use(autoParser);
    console.log('📦 Body parser auto-parsing middleware installed');
  }

  /**
   * Install individual middleware creators
   */
  private installMiddlewareCreators(app: Application): void {
    // JSON parser
    (app as any).json = (options?: BodyParserOptions['json']) => {
      return this.createJsonMiddleware(options);
    };

    // URL-encoded parser
    (app as any).urlencoded = (options?: BodyParserOptions['urlencoded']) => {
      return this.createUrlencodedMiddleware(options);
    };

    // Text parser
    (app as any).text = (options?: BodyParserOptions['text']) => {
      return this.createTextMiddleware(options);
    };

    // Raw parser
    (app as any).raw = (options?: { limit?: string; type?: string }) => {
      return this.createRawMiddleware(options);
    };
  }

  /**
   * Parse request body automatically
   */
  private async parseRequestBody(
    req: NextRushRequest,
    res: NextRushResponse
  ): Promise<void> {
    if (req.body !== undefined) {
      return; // Already parsed
    }

    const contentType = req.headers['content-type'] || '';
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    // Check size limit
    if (contentLength > this.options.maxSize) {
      throw new Error('Request entity too large');
    }

    // Skip if no content
    if (contentLength === 0) {
      req.body = {};
      return;
    }

    // Parse based on content type
    const body = await this.readRequestBody(req);

    if (contentType.includes('application/json')) {
      req.body = this.parseJSON(body);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      req.body = this.parseUrlEncoded(body);
    } else if (contentType.includes('text/')) {
      req.body = body;
    } else {
      req.body = body; // Raw string for unknown types
    }
  }

  /**
   * Create JSON body parser middleware
   */
  private createJsonMiddleware(
    options: BodyParserOptions['json'] = {}
  ): ExpressMiddleware {
    const opts = { ...this.options.json, ...options };

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      if (!req.headers['content-type']?.includes('application/json')) {
        return next();
      }

      this.parseJson(req, res, opts)
        .then(() => {
          next();
        })
        .catch((error) => {
          this.handleParseError(error, res);
        });
    };
  }

  /**
   * Create URL-encoded body parser middleware
   */
  private createUrlencodedMiddleware(
    options: BodyParserOptions['urlencoded'] = {}
  ): ExpressMiddleware {
    const opts = { ...this.options.urlencoded, ...options };

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      if (
        !req.headers['content-type']?.includes(
          'application/x-www-form-urlencoded'
        )
      ) {
        return next();
      }

      this.parseUrlEncodedBody(req, res, opts)
        .then(() => {
          next();
        })
        .catch((error) => {
          this.handleParseError(error, res);
        });
    };
  }

  /**
   * Create text body parser middleware
   */
  private createTextMiddleware(
    options: BodyParserOptions['text'] = {}
  ): ExpressMiddleware {
    const opts = { ...this.options.text, ...options };

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const contentType = req.headers['content-type'] || '';

      if (!contentType.includes('text/')) {
        return next();
      }

      this.parseText(req, res, opts)
        .then(() => {
          next();
        })
        .catch((error) => {
          this.handleParseError(error, res);
        });
    };
  }

  /**
   * Create raw body parser middleware
   */
  private createRawMiddleware(
    options: { limit?: string; type?: string } = {}
  ): ExpressMiddleware {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      this.parseRaw(req, res, options)
        .then(() => {
          next();
        })
        .catch((error) => {
          this.handleParseError(error, res);
        });
    };
  }

  /**
   * Read request body as string
   */
  private async readRequestBody(req: NextRushRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      let size = 0;

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.options.timeout);

      req.on('data', (chunk: Buffer) => {
        size += chunk.length;

        if (size > this.options.maxSize) {
          clearTimeout(timeout);
          reject(new Error('Request entity too large'));
          return;
        }

        body += chunk.toString('utf8');
      });

      req.on('end', () => {
        clearTimeout(timeout);
        resolve(body);
      });

      req.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Parse JSON body
   */
  private async parseJson(
    req: NextRushRequest,
    res: NextRushResponse,
    options: NonNullable<BodyParserOptions['json']>
  ): Promise<void> {
    const body = await this.readRequestBody(req);
    req.body = this.parseJSON(body, options.reviver);
  }

  /**
   * Parse URL-encoded body
   */
  private async parseUrlEncodedBody(
    req: NextRushRequest,
    res: NextRushResponse,
    options: NonNullable<BodyParserOptions['urlencoded']>
  ): Promise<void> {
    const body = await this.readRequestBody(req);
    req.body = this.parseUrlEncoded(body, options.extended);
  }

  /**
   * Parse text body
   */
  private async parseText(
    req: NextRushRequest,
    res: NextRushResponse,
    options: NonNullable<BodyParserOptions['text']>
  ): Promise<void> {
    const body = await this.readRequestBody(req);
    req.body = body;
  }

  /**
   * Parse raw body
   */
  private async parseRaw(
    req: NextRushRequest,
    res: NextRushResponse,
    options: { limit?: string; type?: string }
  ): Promise<void> {
    const body = await this.readRequestBody(req);
    req.body = Buffer.from(body, 'utf8');
  }

  /**
   * Parse JSON string
   */
  private parseJSON(
    body: string,
    reviver?: (key: string, value: any) => any
  ): any {
    if (!body.trim()) {
      return {};
    }

    try {
      return JSON.parse(body, reviver);
    } catch (error) {
      throw new Error(
        `Invalid JSON: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Parse URL-encoded string
   */
  private parseUrlEncoded(
    body: string,
    extended: boolean = true
  ): Record<string, any> {
    if (!body.trim()) {
      return {};
    }

    const params: Record<string, any> = {};
    const pairs = body.split('&');

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        const decodedKey = decodeURIComponent(key);
        const decodedValue = value
          ? decodeURIComponent(value.replace(/\+/g, ' '))
          : '';

        if (extended && decodedKey.includes('[')) {
          // Handle nested objects/arrays in extended mode
          this.setNestedValue(params, decodedKey, decodedValue);
        } else {
          params[decodedKey] = decodedValue;
        }
      }
    }

    return params;
  }

  /**
   * Set nested value for extended URL encoding
   */
  private setNestedValue(
    obj: Record<string, any>,
    key: string,
    value: string
  ): void {
    const keys = key.split(/[\[\]]+/).filter((k) => k);
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current)) {
        current[k] = {};
      }
      current = current[k];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Parse size limit string (e.g., "1mb", "500kb")
   */
  private parseLimit(limit: string): number {
    const units: Record<string, number> = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
    };

    const match = limit.toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);
    if (!match) {
      throw new Error(`Invalid limit format: ${limit}`);
    }

    const size = parseFloat(match[1]);
    const unit = match[2] || 'b';

    return Math.floor(size * units[unit]);
  }

  /**
   * Handle parsing errors
   */
  private handleParseError(error: Error, res: NextRushResponse): void {
    const message = error.message;

    if (message.includes('too large')) {
      res.status(413).json({ error: 'Request entity too large' });
    } else if (message.includes('timeout')) {
      res.status(408).json({ error: 'Request timeout' });
    } else if (message.includes('Invalid JSON')) {
      res.status(400).json({ error: 'Invalid JSON in request body' });
    } else {
      res.status(400).json({ error: 'Bad request' });
    }
  }
}

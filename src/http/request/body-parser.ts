/**
 * Body parser for HTTP requests - follows single responsibility principle
 */

import { ParsedRequest } from '../../types/http';

export interface BodyParserOptions {
  maxSize?: number;
  timeout?: number;
  allowedContentTypes?: string[];
  strict?: boolean;
}

export interface ParsedBody {
  raw: string;
  parsed: unknown;
  contentType: string;
}

export class BodyParser {
  private options: Required<BodyParserOptions>;

  constructor(options: BodyParserOptions = {}) {
    this.options = {
      maxSize: 1024 * 1024, // 1MB
      timeout: 30000, // 30 seconds
      allowedContentTypes: [
        'application/json',
        'application/x-www-form-urlencoded',
        'text/plain',
      ],
      strict: false,
      ...options,
    };
  }

  async handle(request: ParsedRequest): Promise<ParsedBody> {
    const contentType = request.headers['content-type'] || 'text/plain';
    const contentLength = parseInt(
      request.headers['content-length'] || '0',
      10
    );

    // Validate content length
    this.validateContentLength(contentLength);

    // Validate content type
    if (this.options.strict) {
      this.validateContentType(contentType);
    }

    // Read request body
    const rawBody = await this.readRequestBody(request);

    // Parse body based on content type
    const parsedData = this.parseBody(rawBody, contentType);

    return {
      raw: rawBody,
      parsed: parsedData,
      contentType,
    };
  }

  private validateContentLength(contentLength: number): void {
    if (contentLength > this.options.maxSize) {
      throw new Error(
        `Request body too large. Maximum size: ${this.options.maxSize} bytes`
      );
    }
  }

  private validateContentType(contentType: string): void {
    const isAllowed = this.options.allowedContentTypes.some((type) =>
      contentType.includes(type)
    );

    if (!isAllowed) {
      throw new Error(
        `Unsupported content type: ${contentType}. Allowed: ${this.options.allowedContentTypes.join(
          ', '
        )}`
      );
    }
  }

  private async readRequestBody(request: ParsedRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      let size = 0;

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.options.timeout);

      request.on('data', (chunk: Buffer) => {
        size += chunk.length;

        if (size > this.options.maxSize) {
          clearTimeout(timeout);
          reject(new Error('Request body too large'));
          return;
        }

        body += chunk.toString('utf8');
      });

      request.on('end', () => {
        clearTimeout(timeout);
        resolve(body);
      });

      request.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private parseBody(body: string, contentType: string): unknown {
    if (!body.trim()) {
      return {};
    }

    try {
      if (contentType.includes('application/json')) {
        return this.parseJSON(body);
      }

      if (contentType.includes('application/x-www-form-urlencoded')) {
        return this.parseURLEncoded(body);
      }

      // Return as plain text for other content types
      return body;
    } catch (error) {
      if (this.options.strict) {
        throw new Error(
          `Failed to parse body: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
      return body; // Return raw body if parsing fails in non-strict mode
    }
  }

  private parseJSON(body: string): unknown {
    try {
      return JSON.parse(body);
    } catch (error) {
      throw new Error(
        `Invalid JSON: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  private parseURLEncoded(body: string): Record<string, string> {
    const params: Record<string, string> = {};

    if (!body) return params;

    const pairs = body.split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = value
          ? decodeURIComponent(value.replace(/\+/g, ' '))
          : '';
      }
    }

    return params;
  }

  /**
   * Update parser configuration
   */
  configure(options: Partial<BodyParserOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Body parser for HTTP requests - follows single responsibility principle
 */
import {
  PayloadTooLargeError,
  RequestTimeoutError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../../errors';
import { AsyncHandler } from '../../types/common';
import { BodyParserOptions, ParsedRequest } from '../../types/http';
import { isContentType, parseContentType } from '../../utils/content-type';

export interface ParsedBody {
  raw: string;
  parsed: unknown;
  contentType: string;
}

export class BodyParser implements AsyncHandler<ParsedRequest, ParsedBody> {
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

    // Validate content type if strict mode
    if (this.options.strict) {
      this.validateContentType(contentType);
    }

    // Read request body
    const rawBody = await this.readRequestBody(request);

    // Parse body based on content type
    const parsedBody = this.parseBody(rawBody, contentType);

    return {
      raw: rawBody,
      parsed: parsedBody,
      contentType,
    };
  }

  private validateContentLength(contentLength: number): void {
    if (contentLength > this.options.maxSize) {
      throw new PayloadTooLargeError(this.options.maxSize, contentLength);
    }
  }

  private validateContentType(contentType: string): void {
    const isAllowed = this.options.allowedContentTypes.some((allowedType) =>
      isContentType(contentType, allowedType)
    );

    if (!isAllowed) {
      throw new UnsupportedMediaTypeError(
        contentType,
        this.options.allowedContentTypes
      );
    }
  }

  private async readRequestBody(request: ParsedRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      let timeoutId: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      // Set timeout
      if (this.options.timeout > 0) {
        timeoutId = setTimeout(() => {
          cleanup();
          reject(new RequestTimeoutError(this.options.timeout));
        }, this.options.timeout);
      }

      request.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;

        if (totalSize > this.options.maxSize) {
          cleanup();
          reject(new PayloadTooLargeError(this.options.maxSize, totalSize));
          return;
        }

        chunks.push(chunk);
      });

      request.on('end', () => {
        cleanup();
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(body);
      });

      request.on('error', (error) => {
        cleanup();
        reject(
          new ValidationError('Request stream error', {
            originalError: error.message,
          })
        );
      });

      request.on('aborted', () => {
        cleanup();
        reject(new ValidationError('Request was aborted'));
      });
    });
  }

  private parseBody(body: string, contentType: string): unknown {
    const { type } = parseContentType(contentType);

    try {
      switch (type) {
        case 'application/json':
          return this.parseJSON(body);

        case 'application/x-www-form-urlencoded':
          return this.parseURLEncoded(body);

        case 'text/plain':
        default:
          return body;
      }
    } catch (error) {
      throw new ValidationError('Failed to parse request body', {
        contentType,
        error: error instanceof Error ? error.message : 'Unknown error',
        body: body.substring(0, 100), // First 100 chars for debugging
      });
    }
  }

  private parseJSON(body: string): unknown {
    if (!body.trim()) {
      return {};
    }
    return JSON.parse(body);
  }

  private parseURLEncoded(body: string): Record<string, string> {
    const params: Record<string, string> = {};

    if (!body.trim()) {
      return params;
    }

    const pairs = body.split('&');

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key && value !== undefined) {
        try {
          params[decodeURIComponent(key)] = decodeURIComponent(value);
        } catch (error) {
          throw new ValidationError('Invalid URL-encoded data', {
            pair,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
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

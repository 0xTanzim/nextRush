/**
 * Request handler - processes incoming HTTP requests
 *
 * ❌ DEPRECATED: This module is replaced by MegaUltimateParser
 *
 * 🚨 PERFORMANCE WARNING: This creates duplicate request processing!
 * Use BodyParserPlugin instead for better performance.
 */

import { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import { ParsedRequest } from '../../types/http';

export interface RequestParsingOptions {
  parseBody?: boolean;
}

export class RequestHandler {
  constructor() {
    // ❌ DEPRECATED: Body parsing now handled by BodyParserPlugin
    console.warn(
      '[NEXTRUSH_DEPRECATED_2025] RequestHandler is deprecated. Use BodyParserPlugin instead.'
    );
  }

  async handle(request: IncomingMessage): Promise<ParsedRequest> {
    const parsedRequest = this.enhanceRequest(request);

    // ❌ DEPRECATED: Body parsing now handled by BodyParserPlugin
    // Use BodyParserPlugin for automatic body parsing instead
    console.warn(
      '[NEXTRUSH_DEPRECATED_2025] RequestHandler.handle() body parsing is deprecated.'
    );
    parsedRequest.body = {}; // Empty body - use BodyParserPlugin instead

    return parsedRequest;
  }

  /**
   * Enhance the basic IncomingMessage with additional properties
   */
  private enhanceRequest(request: IncomingMessage): ParsedRequest {
    const enhanced = request as ParsedRequest;

    // Parse URL and query parameters
    const parsed = parseUrl(enhanced.url || '', true);
    enhanced.pathname = parsed.pathname || '/';
    enhanced.query = parsed.query;
    enhanced.params = {};

    // Add original URL
    enhanced.originalUrl = enhanced.url || '/';

    return enhanced;
  }

  /**
   * Determine if we should attempt to parse the request body
   */
  private shouldParseBody(request: ParsedRequest): boolean {
    const method = request.method?.toUpperCase();
    const contentLength = parseInt(
      request.headers['content-length'] || '0',
      10
    );

    // Only parse body for methods that typically have body content
    const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];
    return methodsWithBody.includes(method || '') && contentLength > 0;
  }

  /**
   * Parse specific parts of the request
   *
   * ❌ DEPRECATED: Use BodyParserPlugin instead
   */
  async parseRequest(
    request: IncomingMessage,
    options: RequestParsingOptions = {}
  ): Promise<ParsedRequest> {
    const parsedRequest = this.enhanceRequest(request);

    // ❌ DEPRECATED: Body parsing now handled by BodyParserPlugin
    console.warn(
      '[NEXTRUSH_DEPRECATED_2025] RequestHandler.parseRequest() is deprecated. Use BodyParserPlugin instead.'
    );
    parsedRequest.body = {}; // Empty body - use BodyParserPlugin instead

    return parsedRequest;
  }

  /**
   * Configure the body parser
   *
   * ❌ DEPRECATED: Use BodyParserPlugin configuration instead
   */
  configureBodyParser(options: any): void {
    console.warn(
      '[NEXTRUSH_DEPRECATED_2025] RequestHandler.configureBodyParser() is deprecated. Configure BodyParserPlugin instead.'
    );
  }
}

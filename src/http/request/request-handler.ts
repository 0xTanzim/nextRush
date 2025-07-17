/**
 * Request handler - processes incoming HTTP requests
 */

import { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import { ParsedRequest } from '../../types/http';
import { BodyParser } from './body-parser';

export interface RequestParsingOptions {
  parseBody?: boolean;
  bodyParser?: BodyParser;
}

export class RequestHandler {
  private bodyParser: BodyParser;

  constructor(bodyParser?: BodyParser) {
    this.bodyParser = bodyParser || new BodyParser();
  }

  async handle(request: IncomingMessage): Promise<ParsedRequest> {
    const parsedRequest = this.enhanceRequest(request);

    // Parse body for methods that typically have body content
    if (this.shouldParseBody(parsedRequest)) {
      try {
        const bodyData = await this.bodyParser.handle(parsedRequest);
        parsedRequest.body = bodyData.parsed;
      } catch (error) {
        console.warn('Body parsing failed:', error);
        parsedRequest.body = {};
      }
    } else {
      parsedRequest.body = {};
    }

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
   */
  async parseRequest(
    request: IncomingMessage,
    options: RequestParsingOptions = {}
  ): Promise<ParsedRequest> {
    const parsedRequest = this.enhanceRequest(request);

    if (options.parseBody !== false && this.shouldParseBody(parsedRequest)) {
      const parser = options.bodyParser || this.bodyParser;
      try {
        const bodyData = await parser.handle(parsedRequest);
        parsedRequest.body = bodyData.parsed;
      } catch (error) {
        console.warn('Body parsing failed:', error);
        parsedRequest.body = {};
      }
    }

    return parsedRequest;
  }

  /**
   * Configure the body parser
   */
  configureBodyParser(options: Parameters<BodyParser['configure']>[0]): void {
    this.bodyParser.configure(options);
  }
}

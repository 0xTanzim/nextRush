/**
 * Request handler - processes incoming HTTP requests
 */
import { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import { AsyncHandler } from '../../types/common';
import { ParsedRequest, RequestParsingOptions } from '../../types/http';
import { BodyParser } from './body-parser';

export class RequestHandler
  implements AsyncHandler<IncomingMessage, ParsedRequest>
{
  private bodyParser: BodyParser;

  constructor(bodyParser?: BodyParser) {
    this.bodyParser = bodyParser || new BodyParser();
  }

  async handle(request: IncomingMessage): Promise<ParsedRequest> {
    const parsedRequest = this.enhanceRequest(request);

    // Parse body for methods that typically have body content
    if (this.shouldParseBody(parsedRequest)) {
      try {
        const bodyResult = await this.bodyParser.handle(parsedRequest);
        parsedRequest.body = bodyResult.parsed;
      } catch (error) {
        // For GET requests and other methods without body, ignore body parsing errors
        if (this.requiresBody(parsedRequest)) {
          throw error;
        }
        parsedRequest.body = null;
      }
    } else {
      parsedRequest.body = null;
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
    enhanced.query = parsed.query;
    enhanced.pathname = parsed.pathname || '/';
    enhanced.originalUrl = enhanced.url || '';

    // Initialize empty params (will be set by router)
    enhanced.params = {};

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

    // Always try to parse if there's content
    if (contentLength > 0) {
      return true;
    }

    // Parse for methods that typically have bodies
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method || '');
  }

  /**
   * Determine if the request method requires a body
   */
  private requiresBody(request: ParsedRequest): boolean {
    const method = request.method?.toUpperCase();
    return ['POST', 'PUT', 'PATCH'].includes(method || '');
  }

  /**
   * Parse specific parts of the request
   */
  async parseRequest(
    request: IncomingMessage,
    options: RequestParsingOptions = {}
  ): Promise<ParsedRequest> {
    const enhanced = this.enhanceRequest(request);

    if (options.parseBody && this.shouldParseBody(enhanced)) {
      try {
        const bodyResult = await this.bodyParser.handle(enhanced);
        enhanced.body = bodyResult.parsed;
      } catch (error) {
        if (this.requiresBody(enhanced)) {
          throw error;
        }
        enhanced.body = null;
      }
    }

    return enhanced;
  }

  /**
   * Configure the body parser
   */
  configureBodyParser(options: Parameters<BodyParser['configure']>[0]): void {
    this.bodyParser.configure(options);
  }
}

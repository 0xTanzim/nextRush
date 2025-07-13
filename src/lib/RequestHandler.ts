import { IncomingMessage } from 'node:http';
import { parse as parseUrl } from 'url';
import { Request } from '../types/Request';

export class RequestHandler {
  static enhanceRequest(req: IncomingMessage): Request {
    const request = req as Request;

    // Parse URL
    const parsed = parseUrl(request.url || '', true);
    request.query = parsed.query;
    request.pathname = parsed.pathname || '';

    return request;
  }
}

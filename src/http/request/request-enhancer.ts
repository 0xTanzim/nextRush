/**
 * Request enhancer - converts Node.js IncomingMessage to Express-style request
 */
import { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import { NextRushRequest } from '../../types/express';

export class RequestEnhancer {
  static enhance(req: IncomingMessage): NextRushRequest {
    const enhanced = req as NextRushRequest;

    // Parse URL
    const parsed = parseUrl(enhanced.url || '', true);
    enhanced.query = parsed.query;
    enhanced.pathname = parsed.pathname || '/';
    enhanced.path = enhanced.pathname;
    enhanced.originalUrl = enhanced.url || '';

    // Initialize params and body
    enhanced.params = {};
    enhanced.body = null;

    // Add helper methods
    enhanced.param = function (name: string): string | undefined {
      return this.params[name];
    };

    enhanced.header = enhanced.get = function (
      name: string
    ): string | undefined {
      const key = name.toLowerCase();
      const headers = this.headers;
      return headers[key] as string | undefined;
    };

    return enhanced;
  }
}

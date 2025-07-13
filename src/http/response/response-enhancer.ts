/**
 * Response enhancer - converts Node.js ServerResponse to Express-style response
 */
import { ServerResponse } from 'http';
import { NextRushResponse } from '../../types/express';

export class ResponseEnhancer {
  static enhance(res: ServerResponse): NextRushResponse {
    const enhanced = res as NextRushResponse;

    // Initialize locals
    enhanced.locals = {};

    // Status method
    enhanced.status = function (code: number): NextRushResponse {
      this.statusCode = code;
      return this;
    };

    // JSON response
    enhanced.json = function (data: any): void {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(data));
    };

    // Send response
    enhanced.send = function (data: string | Buffer | object): void {
      if (typeof data === 'object' && !(data instanceof Buffer)) {
        this.json(data);
      } else if (typeof data === 'string') {
        this.setHeader('Content-Type', 'text/html');
        this.end(data);
      } else {
        this.end(data);
      }
    };

    // HTML response
    enhanced.html = function (data: string): void {
      this.setHeader('Content-Type', 'text/html');
      this.end(data);
    };

    // Text response
    enhanced.text = function (data: string): void {
      this.setHeader('Content-Type', 'text/plain');
      this.end(data);
    };

    // Redirect
    enhanced.redirect = function (url: string, status: number = 302): void {
      this.statusCode = status;
      this.setHeader('Location', url);
      this.end();
    };

    // Set headers
    enhanced.set = enhanced.header = function (
      field: string,
      value: string
    ): NextRushResponse {
      this.setHeader(field, value);
      return this;
    };

    // Get headers
    enhanced.get = function (field: string): string | undefined {
      return this.getHeader(field) as string | undefined;
    };

    // Basic cookie methods
    enhanced.cookie = function (
      name: string,
      value: string,
      options: any = {}
    ): NextRushResponse {
      let cookie = `${name}=${value}`;

      if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
      if (options.expires)
        cookie += `; Expires=${options.expires.toUTCString()}`;
      if (options.path) cookie += `; Path=${options.path}`;
      if (options.domain) cookie += `; Domain=${options.domain}`;
      if (options.secure) cookie += '; Secure';
      if (options.httpOnly) cookie += '; HttpOnly';
      if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;

      const existing = this.getHeader('Set-Cookie') || [];
      const cookies = Array.isArray(existing) ? existing : [existing];
      cookies.push(cookie);
      this.setHeader('Set-Cookie', cookies.map(String));

      return this;
    };

    enhanced.clearCookie = function (name: string): NextRushResponse {
      return this.cookie(name, '', { expires: new Date(0) });
    };

    return enhanced;
  }
}

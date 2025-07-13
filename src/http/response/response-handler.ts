/**
 * Response handler - handles HTTP response formatting and sending
 */
import { SyncHandler } from '../../types/common';
import { ParsedResponse } from '../../types/http';
import { buildContentType, CONTENT_TYPES } from '../../utils/content-type';

export interface ResponseData {
  body?: unknown;
  status?: number;
  headers?: Record<string, string>;
  contentType?: string;
}

export class ResponseHandler implements SyncHandler<ResponseData, void> {
  handle(_data: ResponseData): void {
    // This method signature is for the interface, actual usage will pass response object
    throw new Error('Use sendResponse method instead');
  }

  /**
   * Send a response with the given data
   */
  sendResponse(response: ParsedResponse, data: ResponseData): void {
    const {
      body,
      status = 200,
      headers = {},
      contentType = CONTENT_TYPES.JSON,
    } = data;

    // Set status code
    response.statusCode = status;

    // Set content type with charset
    const fullContentType = buildContentType(contentType);
    response.setHeader('Content-Type', fullContentType);

    // Set additional headers
    Object.entries(headers).forEach(([key, value]) => {
      response.setHeader(key, value);
    });

    // Send body
    if (body !== undefined) {
      const responseBody = this.serializeBody(body, contentType);
      response.end(responseBody);
    } else {
      response.end();
    }
  }

  /**
   * Send JSON response
   */
  json(response: ParsedResponse, data: unknown, status: number = 200): void {
    this.sendResponse(response, {
      body: data,
      status,
      contentType: CONTENT_TYPES.JSON,
    });
  }

  /**
   * Send text response
   */
  text(response: ParsedResponse, text: string, status: number = 200): void {
    this.sendResponse(response, {
      body: text,
      status,
      contentType: CONTENT_TYPES.TEXT,
    });
  }

  /**
   * Send HTML response
   */
  html(response: ParsedResponse, html: string, status: number = 200): void {
    this.sendResponse(response, {
      body: html,
      status,
      contentType: CONTENT_TYPES.HTML,
    });
  }

  /**
   * Send status-only response
   */
  status(response: ParsedResponse, statusCode: number): void {
    this.sendResponse(response, {
      status: statusCode,
    });
  }

  /**
   * Redirect to another URL
   */
  redirect(response: ParsedResponse, url: string, status: number = 302): void {
    response.statusCode = status;
    response.setHeader('Location', url);
    response.end();
  }

  /**
   * Send error response
   */
  error(response: ParsedResponse, message: string, status: number = 500): void {
    this.json(response, { error: message }, status);
  }

  /**
   * Set response headers
   */
  setHeaders(response: ParsedResponse, headers: Record<string, string>): void {
    Object.entries(headers).forEach(([key, value]) => {
      response.setHeader(key, value);
    });
  }

  /**
   * Set a single header
   */
  setHeader(response: ParsedResponse, key: string, value: string): void {
    response.setHeader(key, value);
  }

  /**
   * Set response status code
   */
  setStatus(response: ParsedResponse, status: number): void {
    response.statusCode = status;
  }

  /**
   * Check if response headers have been sent
   */
  headersSent(response: ParsedResponse): boolean {
    return response.headersSent;
  }

  private serializeBody(body: unknown, contentType: string): string {
    if (typeof body === 'string') {
      return body;
    }

    if (contentType.includes('application/json')) {
      return JSON.stringify(body);
    }

    if (body === null || body === undefined) {
      return '';
    }

    return String(body);
  }
}

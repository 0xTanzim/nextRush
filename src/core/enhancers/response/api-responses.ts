/**
 * API Response Helpers for NextRush v2
 *
 * Standardized API response formats for success, error, and pagination.
 *
 * @packageDocumentation
 */

import type { ServerResponse } from 'node:http';

/**
 * Standard success response structure
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message: string;
  timestamp: string;
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  error: string;
  details?: unknown;
  timestamp: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T = unknown> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
  timestamp: string;
}

/**
 * Send a success response
 *
 * @param res - Server response object
 * @param data - Response data
 * @param message - Optional success message
 *
 * @example
 * ```typescript
 * sendSuccess(res, { user: { id: 1, name: 'John' } }, 'User retrieved');
 * ```
 */
export function sendSuccess<T>(
  res: ServerResponse,
  data: T,
  message: string = 'Success'
): void {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };

  sendJson(res, response);
}

/**
 * Send an error response
 *
 * @param res - Server response object
 * @param message - Error message
 * @param statusCode - HTTP status code (default: 500)
 * @param details - Optional error details
 *
 * @example
 * ```typescript
 * sendError(res, 'User not found', 404);
 * sendError(res, 'Validation failed', 400, { field: 'email' });
 * ```
 */
export function sendError(
  res: ServerResponse,
  message: string,
  statusCode: number = 500,
  details?: unknown
): void {
  const response: ErrorResponse = {
    success: false,
    error: message,
    details,
    timestamp: new Date().toISOString(),
  };

  res.statusCode = statusCode;
  sendJson(res, response);
}

/**
 * Send a paginated response
 *
 * @param res - Server response object
 * @param data - Array of items
 * @param page - Current page number
 * @param limit - Items per page
 * @param total - Total number of items
 *
 * @example
 * ```typescript
 * const users = await getUsers(page, limit);
 * const total = await countUsers();
 * sendPaginated(res, users, page, limit, total);
 * ```
 */
export function sendPaginated<T>(
  res: ServerResponse,
  data: T[],
  page: number,
  limit: number,
  total: number
): void {
  const totalPages = Math.ceil(total / limit);

  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    timestamp: new Date().toISOString(),
  };

  sendJson(res, response);
}

/**
 * Send JSON response (internal helper)
 *
 * @param res - Server response object
 * @param data - Data to send as JSON
 */
function sendJson(res: ServerResponse, data: unknown): void {
  const jsonString = JSON.stringify(data);

  if (!res.headersSent) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(jsonString).toString());
  }

  res.end(jsonString);
}

/**
 * Create a not found error response
 *
 * @param res - Server response object
 * @param resource - Name of the resource
 */
export function sendNotFound(res: ServerResponse, resource: string = 'Resource'): void {
  sendError(res, `${resource} not found`, 404);
}

/**
 * Create an unauthorized error response
 *
 * @param res - Server response object
 * @param message - Custom message
 */
export function sendUnauthorized(res: ServerResponse, message: string = 'Unauthorized'): void {
  sendError(res, message, 401);
}

/**
 * Create a forbidden error response
 *
 * @param res - Server response object
 * @param message - Custom message
 */
export function sendForbidden(res: ServerResponse, message: string = 'Forbidden'): void {
  sendError(res, message, 403);
}

/**
 * Create a bad request error response
 *
 * @param res - Server response object
 * @param message - Custom message
 * @param details - Validation errors or details
 */
export function sendBadRequest(
  res: ServerResponse,
  message: string = 'Bad Request',
  details?: unknown
): void {
  sendError(res, message, 400, details);
}

/**
 * Create a created response (201)
 *
 * @param res - Server response object
 * @param data - Created resource data
 * @param message - Success message
 */
export function sendCreated<T>(
  res: ServerResponse,
  data: T,
  message: string = 'Created successfully'
): void {
  res.statusCode = 201;
  sendSuccess(res, data, message);
}

/**
 * Send no content response (204)
 *
 * @param res - Server response object
 */
export function sendNoContent(res: ServerResponse): void {
  res.statusCode = 204;
  res.end();
}

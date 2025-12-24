/**
 * Content Negotiation utilities for NextRush v2
 *
 * Handles content-type checking and accept header parsing.
 *
 * @packageDocumentation
 */

import type { IncomingHttpHeaders } from 'node:http';

/**
 * MIME type mapping for common content types
 */
const MIME_TYPE_MAP: Record<string, string> = {
  json: 'application/json',
  html: 'text/html',
  xml: 'application/xml',
  text: 'text/plain',
  form: 'application/x-www-form-urlencoded',
  multipart: 'multipart/form-data',
  css: 'text/css',
  js: 'application/javascript',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
};

/**
 * Check if request content-type matches the given type
 *
 * @param headers - Request headers
 * @param type - Type to check (e.g., 'json', 'html', or full MIME type)
 * @returns true if content-type matches
 *
 * @example
 * ```typescript
 * if (isContentType(req.headers, 'json')) {
 *   // Handle JSON request
 * }
 * ```
 */
export function isContentType(
  headers: IncomingHttpHeaders,
  type: string
): boolean {
  const contentType = (headers['content-type'] as string) || '';
  const checkType = MIME_TYPE_MAP[type] || type;
  return contentType.toLowerCase().includes(checkType.toLowerCase());
}

/**
 * Check which content type the client accepts
 *
 * @param headers - Request headers
 * @param types - Types to check (e.g., ['json', 'html'])
 * @returns First accepted type or false if none match
 *
 * @example
 * ```typescript
 * const accepted = acceptsType(req.headers, ['json', 'html']);
 * if (accepted === 'json') {
 *   res.json(data);
 * }
 * ```
 */
export function acceptsType(
  headers: IncomingHttpHeaders,
  types: string | string[]
): string | false {
  const acceptHeader = (headers.accept as string) || '*/*';
  const typeArray = Array.isArray(types) ? types : [types];

  for (const type of typeArray) {
    const checkType = MIME_TYPE_MAP[type] || type;
    if (acceptHeader.includes(checkType) || acceptHeader.includes('*/*')) {
      return type;
    }
  }

  return false;
}

/**
 * Get the full MIME type for a short type name
 *
 * @param type - Short type name (e.g., 'json')
 * @returns Full MIME type or the input if not found
 */
export function getMimeType(type: string): string {
  return MIME_TYPE_MAP[type] || type;
}

/**
 * Parse the Accept header into weighted types
 *
 * @param acceptHeader - Accept header value
 * @returns Array of accepted types sorted by quality
 */
export function parseAcceptHeader(
  acceptHeader: string
): Array<{ type: string; quality: number }> {
  if (!acceptHeader) return [{ type: '*/*', quality: 1 }];

  return acceptHeader
    .split(',')
    .map((part) => {
      const [type, ...params] = part.trim().split(';');
      let quality = 1;

      for (const param of params) {
        const [key, value] = param.trim().split('=');
        if (key === 'q' && value) {
          quality = parseFloat(value) || 1;
        }
      }

      return { type: type?.trim() || '*/*', quality };
    })
    .sort((a, b) => b.quality - a.quality);
}

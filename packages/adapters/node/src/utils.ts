/**
 * @nextrush/adapter-node - Utility Functions
 *
 * @packageDocumentation
 */

// Re-export shared hardened query parser (single source of truth)
export { parseQueryString } from '@nextrush/runtime';

/**
 * Get content length from headers
 */
export function getContentLength(headers: Record<string, unknown>): number | undefined {
  const length = headers['content-length'];
  if (typeof length === 'string') {
    const parsed = parseInt(length, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Get content type from headers
 */
export function getContentType(headers: Record<string, unknown>): string | undefined {
  const type = headers['content-type'];
  if (typeof type === 'string') {
    // Remove charset and other params
    const semiIndex = type.indexOf(';');
    return semiIndex !== -1 ? type.slice(0, semiIndex).trim() : type.trim();
  }
  return undefined;
}

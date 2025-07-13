/**
 * Content type utilities - pure functions for content type handling
 */

export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_ENCODED: 'application/x-www-form-urlencoded',
  TEXT: 'text/plain',
  HTML: 'text/html',
  MULTIPART: 'multipart/form-data',
  OCTET_STREAM: 'application/octet-stream',
} as const;

/**
 * Parse content type header to extract main type and charset
 */
export function parseContentType(contentType: string): {
  type: string;
  charset?: string;
  boundary?: string;
} {
  const parts = contentType.toLowerCase().split(';');
  const type = parts[0].trim();

  const result: { type: string; charset?: string; boundary?: string } = {
    type,
  };

  for (let i = 1; i < parts.length; i++) {
    const [key, value] = parts[i].split('=').map((s) => s.trim());
    if (key === 'charset') {
      result.charset = value;
    } else if (key === 'boundary') {
      result.boundary = value;
    }
  }

  return result;
}

/**
 * Check if content type matches expected type
 */
export function isContentType(
  contentType: string,
  expectedType: string
): boolean {
  const parsed = parseContentType(contentType);
  return parsed.type === expectedType.toLowerCase();
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(extension: string): string {
  const ext = extension.toLowerCase().replace('.', '');

  const mimeTypes: Record<string, string> = {
    html: CONTENT_TYPES.HTML,
    htm: CONTENT_TYPES.HTML,
    json: CONTENT_TYPES.JSON,
    js: 'application/javascript',
    css: 'text/css',
    txt: CONTENT_TYPES.TEXT,
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    xml: 'application/xml',
  };

  return mimeTypes[ext] || CONTENT_TYPES.OCTET_STREAM;
}

/**
 * Build content type header with charset
 */
export function buildContentType(
  type: string,
  charset: string = 'utf-8'
): string {
  if (type.includes('text/') || type.includes('application/json')) {
    return `${type}; charset=${charset}`;
  }
  return type;
}

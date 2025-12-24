/**
 * Template Helpers for NextRush v2
 *
 * Provides basic template rendering utilities.
 *
 * @packageDocumentation
 */

/**
 * Template render options
 */
export interface TemplateOptions {
  /** Custom delimiters (default: ['{{', '}}']) */
  delimiters?: [string, string];
  /** Escape HTML (default: true) */
  escapeHtml?: boolean;
  /** Throw on missing variables (default: false) */
  strict?: boolean;
}

/**
 * Render a template string with data
 *
 * @param template - Template string with placeholders
 * @param data - Data object for substitution
 * @param options - Render options
 * @returns Rendered string
 *
 * @example
 * ```typescript
 * const result = renderTemplate('Hello {{name}}!', { name: 'World' });
 * // 'Hello World!'
 *
 * const result2 = renderTemplate('{{user.name}} is {{user.age}}', {
 *   user: { name: 'John', age: 30 }
 * });
 * // 'John is 30'
 * ```
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown>,
  options: TemplateOptions = {}
): string {
  const {
    delimiters = ['{{', '}}'],
    escapeHtml = true,
    strict = false,
  } = options;

  const [open, close] = delimiters;
  const pattern = new RegExp(
    `${escapeRegex(open)}\\s*([\\w.]+)\\s*${escapeRegex(close)}`,
    'g'
  );

  return template.replace(pattern, (match, key: string) => {
    const value = getNestedValue(data, key);

    if (value === undefined || value === null) {
      if (strict) {
        throw new Error(`Template variable not found: ${key}`);
      }
      return '';
    }

    const stringValue = String(value);
    return escapeHtml ? escapeHtmlEntities(stringValue) : stringValue;
  });
}

/**
 * Get nested value from object using dot notation
 *
 * @param obj - Source object
 * @param path - Dot-separated path
 * @returns Value at path or undefined
 *
 * @example
 * ```typescript
 * const obj = { user: { name: 'John', address: { city: 'NYC' } } };
 * getNestedValue(obj, 'user.name');           // 'John'
 * getNestedValue(obj, 'user.address.city');   // 'NYC'
 * getNestedValue(obj, 'user.missing');        // undefined
 * ```
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Check if a value is truthy (for template conditionals)
 *
 * @param value - Value to check
 * @returns true if truthy
 *
 * @example
 * ```typescript
 * isTruthy('hello');     // true
 * isTruthy(1);           // true
 * isTruthy([1, 2]);      // true
 * isTruthy(0);           // false
 * isTruthy('');          // false
 * isTruthy(null);        // false
 * isTruthy([]);          // false (empty array)
 * ```
 */
export function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (value === false || value === 0 || value === '') {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return false;
  }
  return true;
}

/**
 * Escape HTML entities
 *
 * @param str - String to escape
 * @returns Escaped string
 */
export function escapeHtmlEntities(str: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return str.replace(/[&<>"']/g, (char) => entities[char] || char);
}

/**
 * Unescape HTML entities
 *
 * @param str - String to unescape
 * @returns Unescaped string
 */
export function unescapeHtmlEntities(str: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
  };

  return str.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => entities[entity] || entity);
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Simple conditional rendering
 *
 * @param condition - Condition value
 * @param ifTrue - Value if condition is truthy
 * @param ifFalse - Value if condition is falsy
 * @returns Selected value
 */
export function conditional<T>(
  condition: unknown,
  ifTrue: T,
  ifFalse: T
): T {
  return isTruthy(condition) ? ifTrue : ifFalse;
}

/**
 * Format a value for display
 *
 * @param value - Value to format
 * @param type - Format type
 * @returns Formatted string
 */
export function formatValue(
  value: unknown,
  type: 'date' | 'number' | 'currency' | 'percent' = 'number'
): string {
  if (value === null || value === undefined) {
    return '';
  }

  switch (type) {
    case 'date':
      return new Date(value as string | number | Date).toLocaleDateString();
    case 'number':
      return Number(value).toLocaleString();
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(Number(value));
    case 'percent':
      return `${(Number(value) * 100).toFixed(2)}%`;
    default:
      return String(value);
  }
}

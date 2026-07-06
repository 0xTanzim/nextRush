/**
 * @nextrush/validation - Issue Mapping
 *
 * Maps Standard Schema issues onto the framework's existing
 * `@nextrush/errors` `ValidationIssue` shape, so validation failures render
 * identically to every other validation error in NextRush.
 */

import type { ValidationIssue } from '@nextrush/errors';
import type { StandardSchemaIssue } from './standard-schema.js';

/**
 * Join a Standard Schema issue path onto a target prefix, producing a stable,
 * human-readable string.
 *
 * @example
 * joinPath('body', ['address', 'zip'])                 // 'body.address.zip'
 * joinPath('body', [{ key: 'items' }, 0, 'name'])      // 'body.items[0].name'
 * joinPath('query', undefined)                          // 'query'
 */
export function joinPath(
  prefix: string,
  path: StandardSchemaIssue['path']
): string {
  if (!path || path.length === 0) return prefix;

  let out = prefix;
  for (const segment of path) {
    const key = typeof segment === 'object' ? segment.key : segment;
    const rendered = String(key);

    // Numeric keys are array indices; everything else is a dotted property.
    out += typeof key === 'number' ? `[${rendered}]` : `.${rendered}`;
  }
  return out;
}

/**
 * Map Standard Schema issues to `@nextrush/errors` `ValidationIssue[]`.
 *
 * The schema's raw input value is never carried across — Standard Schema
 * issues do not expose it, and `ValidationError.toJSON()` strips `received`
 * regardless — so invalid input (passwords, tokens) cannot leak.
 */
export function mapIssues(
  issues: readonly StandardSchemaIssue[],
  prefix: string
): ValidationIssue[] {
  return issues.map((issue) => ({
    path: joinPath(prefix, issue.path),
    message: issue.message,
  }));
}

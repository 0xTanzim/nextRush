/**
 * @nextrush/request-id - Validation
 *
 * Security validation for incoming request IDs.
 *
 * @packageDocumentation
 */

import { DEFAULT_MAX_LENGTH, MIN_ID_LENGTH } from './constants';
import type { IdValidator } from './types';

// ============================================================================
// Validation Patterns
// ============================================================================

/**
 * UUID v4 format pattern.
 * Matches: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Safe ID pattern - alphanumeric with common separators.
 * Allows: letters, numbers, hyphens, underscores.
 * Prevents: control characters, newlines, special chars.
 */
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

// ============================================================================
// Validators
// ============================================================================

/**
 * Validates UUID v4 format.
 *
 * @param id - The ID to validate
 * @returns True if the ID matches UUID v4 format
 */
export function isValidUuid(id: string): boolean {
  return UUID_PATTERN.test(id);
}

/**
 * Validates that an ID contains only safe characters.
 * Prevents header injection attacks by rejecting:
 * - Control characters
 * - Newlines (CRLF injection)
 * - Spaces and special characters
 *
 * @param id - The ID to validate
 * @returns True if the ID contains only safe characters
 */
export function isSafeId(id: string): boolean {
  return SAFE_ID_PATTERN.test(id);
}

/**
 * Validates ID length within acceptable bounds.
 *
 * @param id - The ID to validate
 * @param maxLength - Maximum allowed length
 * @returns True if the ID length is valid
 */
export function isValidLength(id: string, maxLength: number = DEFAULT_MAX_LENGTH): boolean {
  return id.length >= MIN_ID_LENGTH && id.length <= maxLength;
}

/**
 * Comprehensive ID validator combining all security checks.
 *
 * Validates that the ID:
 * - Has valid length (1-128 characters by default)
 * - Contains only safe characters (alphanumeric, hyphen, underscore)
 * - Does not contain control characters or CRLF sequences
 *
 * @param id - The ID to validate
 * @param maxLength - Maximum allowed length
 * @returns True if the ID passes all validation checks
 */
export function validateId(id: string, maxLength: number = DEFAULT_MAX_LENGTH): boolean {
  return isValidLength(id, maxLength) && isSafeId(id);
}

/**
 * Creates a custom validator with specified maximum length.
 *
 * @param maxLength - Maximum allowed length for IDs
 * @returns Validator function
 */
export function createValidator(maxLength: number = DEFAULT_MAX_LENGTH): IdValidator {
  return (id: string) => validateId(id, maxLength);
}

/**
 * Default validator using UUID format.
 * Validates that incoming IDs match UUID v4 format.
 */
export const defaultValidator: IdValidator = isValidUuid;

/**
 * Permissive validator that accepts any safe ID.
 * Allows alphanumeric IDs with hyphens and underscores.
 */
export const permissiveValidator: IdValidator = (id: string) =>
  validateId(id, DEFAULT_MAX_LENGTH);

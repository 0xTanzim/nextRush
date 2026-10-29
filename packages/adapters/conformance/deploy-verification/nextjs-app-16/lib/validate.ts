/**
 * Dependency-free request validation for the conference-room fixture.
 *
 * Both validators return a discriminated result and never throw: the route
 * handlers decide the HTTP status, keeping this module pure and testable
 * without a server.
 */

import type { RoomInput } from './rooms';

/** Smallest accepted room capacity. */
const MIN_CAPACITY = 1;
/** Largest accepted room capacity, so one client cannot store absurd values. */
const MAX_CAPACITY = 1_000;
/** Longest accepted room name. */
const MAX_NAME_LENGTH = 80;

/** One reason a submitted body was rejected. */
export interface ValidationIssue {
  readonly field: 'body' | 'name' | 'capacity';
  readonly message: string;
}

/** A validated value or the complete list of issues found. */
export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: ValidationIssue[] };

function isJsonObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function readName(value: unknown, issues: ValidationIssue[]): string | undefined {
  if (value === undefined) {
    issues.push({ field: 'name', message: 'name is required' });
    return undefined;
  }
  if (typeof value !== 'string') {
    issues.push({ field: 'name', message: 'name must be a string' });
    return undefined;
  }
  if (value.trim().length === 0) {
    issues.push({ field: 'name', message: 'name must not be empty' });
    return undefined;
  }
  if (value.length > MAX_NAME_LENGTH) {
    issues.push({ field: 'name', message: `name must be at most ${MAX_NAME_LENGTH} characters` });
    return undefined;
  }
  return value;
}

function readCapacity(value: unknown, issues: ValidationIssue[]): number | undefined {
  if (value === undefined) {
    issues.push({ field: 'capacity', message: 'capacity is required' });
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    issues.push({ field: 'capacity', message: 'capacity must be an integer' });
    return undefined;
  }
  if (value < MIN_CAPACITY || value > MAX_CAPACITY) {
    issues.push({
      field: 'capacity',
      message: `capacity must be between ${MIN_CAPACITY} and ${MAX_CAPACITY}`,
    });
    return undefined;
  }
  return value;
}

/** Validate a full create/replace body. */
export function validateRoomInput(input: unknown): ValidationResult<RoomInput> {
  if (!isJsonObject(input)) {
    return { ok: false, issues: [{ field: 'body', message: 'body must be a JSON object' }] };
  }

  const issues: ValidationIssue[] = [];
  const name = readName(input.name, issues);
  const capacity = readCapacity(input.capacity, issues);

  if (issues.length > 0 || name === undefined || capacity === undefined) {
    return { ok: false, issues };
  }
  return { ok: true, value: { name, capacity } };
}

/** Validate a partial update body; at least one known field must be present. */
export function validateRoomPatch(input: unknown): ValidationResult<Partial<RoomInput>> {
  if (!isJsonObject(input)) {
    return { ok: false, issues: [{ field: 'body', message: 'body must be a JSON object' }] };
  }

  const issues: ValidationIssue[] = [];
  const patch: { name?: string; capacity?: number } = {};

  if ('name' in input) {
    const name = readName(input.name, issues);
    if (name !== undefined) patch.name = name;
  }
  if ('capacity' in input) {
    const capacity = readCapacity(input.capacity, issues);
    if (capacity !== undefined) patch.capacity = capacity;
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  if (patch.name === undefined && patch.capacity === undefined) {
    return {
      ok: false,
      issues: [{ field: 'body', message: 'patch must include name or capacity' }],
    };
  }
  return { ok: true, value: patch };
}

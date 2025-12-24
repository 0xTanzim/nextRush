/**
 * @nextrush/template - Built-in Helpers
 *
 * Comprehensive set of helpers for string manipulation, number formatting,
 * date formatting, arrays, objects, comparisons, and more.
 *
 * @packageDocumentation
 */

import type { HelperFn, ValueHelper } from './template.types';

// ============================================================================
// String Helpers
// ============================================================================

/**
 * Convert string to uppercase
 */
export const upper: ValueHelper = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).toUpperCase();
};

/**
 * Convert string to lowercase
 */
export const lower: ValueHelper = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase();
};

/**
 * Capitalize first letter
 */
export const capitalize: ValueHelper = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Capitalize first letter of each word
 */
export const titleCase: ValueHelper = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\b\w/g, char => char.toUpperCase());
};

/**
 * Trim whitespace from both ends
 */
export const trim: ValueHelper = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

/**
 * Truncate string to specified length
 */
export const truncate: ValueHelper = (value, length = 50, suffix = '...') => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  const len = typeof length === 'number' ? length : parseInt(String(length), 10);
  const suf = String(suffix);

  if (str.length <= len) return str;
  return str.slice(0, len - suf.length) + suf;
};

/**
 * Replace occurrences of a substring
 */
export const replace: ValueHelper = (value, search, replacement = '') => {
  if (value === null || value === undefined) return '';
  return String(value).split(String(search)).join(String(replacement));
};

/**
 * Pad string on the left
 */
export const padStart: ValueHelper = (value, length = 0, char = ' ') => {
  if (value === null || value === undefined) return '';
  const len = typeof length === 'number' ? length : parseInt(String(length), 10);
  return String(value).padStart(len, String(char));
};

/**
 * Pad string on the right
 */
export const padEnd: ValueHelper = (value, length = 0, char = ' ') => {
  if (value === null || value === undefined) return '';
  const len = typeof length === 'number' ? length : parseInt(String(length), 10);
  return String(value).padEnd(len, String(char));
};

/**
 * Strip HTML tags from string
 */
export const stripHtml: ValueHelper = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/<[^>]*>/g, '');
};

/**
 * Split string into array
 */
export const split: ValueHelper = (value, separator = ',') => {
  if (value === null || value === undefined) return [];
  return String(value).split(String(separator));
};

/**
 * Join array into string
 */
export const join: ValueHelper = (value, separator = ', ') => {
  if (!Array.isArray(value)) return '';
  return value.join(String(separator));
};

/**
 * Reverse a string or array
 */
export const reverse: ValueHelper = (value) => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return [...value].reverse();
  return String(value).split('').reverse().join('');
};

/**
 * Get string length
 */
export const length: ValueHelper = (value) => {
  if (value === null || value === undefined) return 0;
  if (Array.isArray(value)) return value.length;
  return String(value).length;
};

// ============================================================================
// Number Helpers
// ============================================================================

/**
 * Format number with locale
 */
export const formatNumber: ValueHelper = (value, locale = 'en-US') => {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '';
  return num.toLocaleString(String(locale));
};

/**
 * Format as currency
 */
export const currency: ValueHelper = (value, currencyCode = 'USD', locale = 'en-US') => {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '';
  return num.toLocaleString(String(locale), {
    style: 'currency',
    currency: String(currencyCode),
  });
};

/**
 * Format as percentage
 */
export const percent: ValueHelper = (value, decimals = 0) => {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '';
  const dec = typeof decimals === 'number' ? decimals : parseInt(String(decimals), 10);
  return (num * 100).toFixed(dec) + '%';
};

/**
 * Round to specified decimal places
 */
export const round: ValueHelper = (value, decimals = 0) => {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '';
  const dec = typeof decimals === 'number' ? decimals : parseInt(String(decimals), 10);
  const factor = Math.pow(10, dec);
  return Math.round(num * factor) / factor;
};

/**
 * Floor a number
 */
export const floor: ValueHelper = (value) => {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '';
  return Math.floor(num);
};

/**
 * Ceil a number
 */
export const ceil: ValueHelper = (value) => {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '';
  return Math.ceil(num);
};

/**
 * Get absolute value
 */
export const abs: ValueHelper = (value) => {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '';
  return Math.abs(num);
};

/**
 * Add to a number
 */
export const add: ValueHelper = (value, addend = 0) => {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  const add = typeof addend === 'number' ? addend : parseFloat(String(addend));
  if (isNaN(num) || isNaN(add)) return '';
  return num + add;
};

/**
 * Subtract from a number
 */
export const subtract: ValueHelper = (value, subtrahend = 0) => {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  const sub = typeof subtrahend === 'number' ? subtrahend : parseFloat(String(subtrahend));
  if (isNaN(num) || isNaN(sub)) return '';
  return num - sub;
};

/**
 * Multiply a number
 */
export const multiply: ValueHelper = (value, multiplier = 1) => {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  const mul = typeof multiplier === 'number' ? multiplier : parseFloat(String(multiplier));
  if (isNaN(num) || isNaN(mul)) return '';
  return num * mul;
};

/**
 * Divide a number
 */
export const divide: ValueHelper = (value, divisor = 1) => {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  const div = typeof divisor === 'number' ? divisor : parseFloat(String(divisor));
  if (isNaN(num) || isNaN(div) || div === 0) return '';
  return num / div;
};

/**
 * Modulo operation
 */
export const mod: ValueHelper = (value, divisor = 1) => {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  const div = typeof divisor === 'number' ? divisor : parseFloat(String(divisor));
  if (isNaN(num) || isNaN(div) || div === 0) return '';
  return num % div;
};

// ============================================================================
// Date Helpers
// ============================================================================

/**
 * Format a date
 */
export const formatDate: ValueHelper = (value, format = 'YYYY-MM-DD') => {
  if (value === null || value === undefined) return '';

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    date = new Date(value);
  } else {
    date = new Date(String(value));
  }

  if (isNaN(date.getTime())) return '';

  const fmt = String(format);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  return fmt
    .replace('YYYY', String(year))
    .replace('YY', String(year).slice(-2))
    .replace('MM', String(month).padStart(2, '0'))
    .replace('M', String(month))
    .replace('DD', String(day).padStart(2, '0'))
    .replace('D', String(day))
    .replace('HH', String(hours).padStart(2, '0'))
    .replace('H', String(hours))
    .replace('mm', String(minutes).padStart(2, '0'))
    .replace('m', String(minutes))
    .replace('ss', String(seconds).padStart(2, '0'))
    .replace('s', String(seconds));
};

/**
 * Get relative time (e.g., "2 hours ago")
 */
export const timeAgo: ValueHelper = (value) => {
  if (value === null || value === undefined) return '';

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    date = new Date(value);
  } else {
    date = new Date(String(value));
  }

  if (isNaN(date.getTime())) return '';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} months ago`;
  return `${Math.floor(seconds / 31536000)} years ago`;
};

/**
 * Get current date/time
 */
export const now: ValueHelper = () => {
  return new Date().toISOString();
};

/**
 * Get year from date
 */
export const year: ValueHelper = (value) => {
  if (value === null || value === undefined) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) return '';
  return date.getFullYear();
};

/**
 * Get month from date (1-12)
 */
export const month: ValueHelper = (value) => {
  if (value === null || value === undefined) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) return '';
  return date.getMonth() + 1;
};

/**
 * Get day from date
 */
export const day: ValueHelper = (value) => {
  if (value === null || value === undefined) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) return '';
  return date.getDate();
};

// ============================================================================
// Array Helpers
// ============================================================================

/**
 * Get first element
 */
export const first: ValueHelper = (value) => {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  return value[0];
};

/**
 * Get last element
 */
export const last: ValueHelper = (value) => {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  return value[value.length - 1];
};

/**
 * Get element at index
 */
export const at: ValueHelper = (value, index = 0) => {
  if (!Array.isArray(value)) return undefined;
  const idx = typeof index === 'number' ? index : parseInt(String(index), 10);
  return value[idx];
};

/**
 * Slice an array
 */
export const slice: ValueHelper = (value, start = 0, end) => {
  if (!Array.isArray(value)) return [];
  const startIdx = typeof start === 'number' ? start : parseInt(String(start), 10);
  const endIdx = end !== undefined
    ? (typeof end === 'number' ? end : parseInt(String(end), 10))
    : undefined;
  return value.slice(startIdx, endIdx);
};

/**
 * Sort an array
 */
export const sort: ValueHelper = (value, key) => {
  if (!Array.isArray(value)) return [];
  const arr = [...value];

  if (key) {
    const k = String(key);
    return arr.sort((a, b) => {
      const aVal = a && typeof a === 'object' ? (a as Record<string, unknown>)[k] : a;
      const bVal = b && typeof b === 'object' ? (b as Record<string, unknown>)[k] : b;

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      return String(aVal).localeCompare(String(bVal));
    });
  }

  return arr.sort((a, b) => String(a).localeCompare(String(b)));
};

/**
 * Filter unique values
 */
export const unique: ValueHelper = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value)];
};

/**
 * Compact array (remove falsy values)
 */
export const compact: ValueHelper = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean);
};

/**
 * Flatten nested array
 */
export const flatten: ValueHelper = (value, depth = 1) => {
  if (!Array.isArray(value)) return [];
  const d = typeof depth === 'number' ? depth : parseInt(String(depth), 10);
  return value.flat(d);
};

/**
 * Check if array includes value
 */
export const includes: ValueHelper = (value, item) => {
  if (Array.isArray(value)) return value.includes(item);
  if (typeof value === 'string') return value.includes(String(item));
  return false;
};

/**
 * Find index of item
 */
export const indexOf: ValueHelper = (value, item) => {
  if (Array.isArray(value)) return value.indexOf(item);
  if (typeof value === 'string') return value.indexOf(String(item));
  return -1;
};

// ============================================================================
// Object Helpers
// ============================================================================

/**
 * Get object keys
 */
export const keys: ValueHelper = (value) => {
  if (value === null || value === undefined || typeof value !== 'object') return [];
  return Object.keys(value);
};

/**
 * Get object values
 */
export const values: ValueHelper = (value) => {
  if (value === null || value === undefined || typeof value !== 'object') return [];
  return Object.values(value);
};

/**
 * Get object entries
 */
export const entries: ValueHelper = (value) => {
  if (value === null || value === undefined || typeof value !== 'object') return [];
  return Object.entries(value);
};

/**
 * Get property from object
 */
export const get: ValueHelper = (value, path, defaultValue = undefined) => {
  if (value === null || value === undefined) return defaultValue;

  const parts = String(path).split('.');
  let current: unknown = value;

  for (const part of parts) {
    if (current === null || current === undefined) return defaultValue;
    current = (current as Record<string, unknown>)[part];
  }

  return current !== undefined ? current : defaultValue;
};

// ============================================================================
// Comparison Helpers
// ============================================================================

/**
 * Check equality
 */
export const eq: ValueHelper = (value, other) => {
  return value === other;
};

/**
 * Check inequality
 */
export const ne: ValueHelper = (value, other) => {
  return value !== other;
};

/**
 * Less than
 */
export const lt: ValueHelper = (value, other) => {
  if (value === null || value === undefined) return false;
  if (other === null || other === undefined) return false;
  return value < other;
};

/**
 * Less than or equal
 */
export const lte: ValueHelper = (value, other) => {
  if (value === null || value === undefined) return false;
  if (other === null || other === undefined) return false;
  return value <= other;
};

/**
 * Greater than
 */
export const gt: ValueHelper = (value, other) => {
  if (value === null || value === undefined) return false;
  if (other === null || other === undefined) return false;
  return value > other;
};

/**
 * Greater than or equal
 */
export const gte: ValueHelper = (value, other) => {
  if (value === null || value === undefined) return false;
  if (other === null || other === undefined) return false;
  return value >= other;
};

/**
 * Logical AND
 */
export const and: ValueHelper = (value, other) => {
  return Boolean(value && other);
};

/**
 * Logical OR
 */
export const or: ValueHelper = (value, other) => {
  return Boolean(value || other);
};

/**
 * Logical NOT
 */
export const not: ValueHelper = (value) => {
  return !value;
};

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Check if value is array
 */
export const isArray: ValueHelper = (value) => {
  return Array.isArray(value);
};

/**
 * Check if value is object
 */
export const isObject: ValueHelper = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

/**
 * Check if value is string
 */
export const isString: ValueHelper = (value) => {
  return typeof value === 'string';
};

/**
 * Check if value is number
 */
export const isNumber: ValueHelper = (value) => {
  return typeof value === 'number' && !isNaN(value);
};

/**
 * Check if value is empty
 */
export const isEmpty: ValueHelper = (value) => {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  if (typeof value === 'string') return value.length === 0;
  return false;
};

// ============================================================================
// Output Helpers
// ============================================================================

/**
 * JSON stringify
 */
export const json: ValueHelper = (value, indent = 0) => {
  const spaces = typeof indent === 'number' ? indent : parseInt(String(indent), 10);
  return JSON.stringify(value, null, spaces);
};

/**
 * Mark output as safe (no escaping)
 */
export const safe: ValueHelper = (value) => {
  return value;
};

/**
 * Default value if null/undefined
 */
export const defaultValue: ValueHelper = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return value;
};

/**
 * Conditional value
 */
export const conditional: ValueHelper = (value, ifTrue = '', ifFalse = '') => {
  return value ? ifTrue : ifFalse;
};

// ============================================================================
// Helper Registry
// ============================================================================

/**
 * All built-in helpers
 */
export const builtinHelpers: Record<string, HelperFn | ValueHelper> = {
  // String
  upper,
  lower,
  capitalize,
  titleCase,
  trim,
  truncate,
  replace,
  padStart,
  padEnd,
  stripHtml,
  split,
  join,
  reverse,
  length,

  // Number
  formatNumber,
  currency,
  percent,
  round,
  floor,
  ceil,
  abs,
  add,
  subtract,
  multiply,
  divide,
  mod,

  // Date
  formatDate,
  timeAgo,
  now,
  year,
  month,
  day,

  // Array
  first,
  last,
  at,
  slice,
  sort,
  unique,
  compact,
  flatten,
  includes,
  indexOf,

  // Object
  keys,
  values,
  entries,
  get,

  // Comparison
  eq,
  ne,
  lt,
  lte,
  gt,
  gte,
  and,
  or,
  not,

  // Type
  isArray,
  isObject,
  isString,
  isNumber,
  isEmpty,

  // Output
  json,
  safe,
  default: defaultValue,
  if: conditional,
};

/**
 * Create a helpers registry with built-in helpers
 */
export function createHelperRegistry(): Map<string, HelperFn | ValueHelper> {
  return new Map(Object.entries(builtinHelpers));
}

/**
 * Data Converters Unit Tests
 */

import {
  convertToCSV,
  parseCSV,
} from '@/core/enhancers/response/data-converters';
import { describe, expect, it } from 'vitest';

describe('Data Converters', () => {
  describe('convertToCSV', () => {
    it('should convert array of objects to CSV', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ];
      const csv = convertToCSV(data);

      expect(csv).toContain('"name","age"');
      expect(csv).toContain('"John","30"');
      expect(csv).toContain('"Jane","25"');
    });

    it('should return empty string for empty array', () => {
      expect(convertToCSV([])).toBe('');
    });

    it('should handle objects with special characters', () => {
      const data = [{ text: 'Hello, "World"' }];
      const csv = convertToCSV(data);

      expect(csv).toContain('""World""'); // Double quotes escaped
    });

    it('should handle null and undefined values', () => {
      const data = [
        { name: 'John', value: null },
        { name: 'Jane', value: undefined },
      ];
      const csv = convertToCSV(data);

      expect(csv).toContain('""'); // Empty values
    });

    it('should use custom delimiter', () => {
      const data = [{ a: 1, b: 2 }];
      const csv = convertToCSV(data, { delimiter: ';' });

      expect(csv).toContain('"a";"b"');
    });

    it('should exclude headers when configured', () => {
      const data = [{ name: 'John' }];
      const csv = convertToCSV(data, { includeHeaders: false });

      expect(csv).not.toContain('"name"');
      expect(csv).toContain('"John"');
    });

    it('should use custom headers', () => {
      const data = [{ a: 1, b: 2, c: 3 }];
      const csv = convertToCSV(data, { headers: ['a', 'c'] });

      expect(csv).toContain('"a","c"');
      expect(csv).not.toContain('"b"');
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-01-15T00:00:00.000Z');
      const data = [{ date }];
      const csv = convertToCSV(data);

      expect(csv).toContain('2024-01-15');
    });

    it('should handle nested objects', () => {
      const data = [{ nested: { key: 'value' } }];
      const csv = convertToCSV(data);

      // Nested objects are JSON stringified, then quoted with escaped inner quotes
      expect(csv).toContain('nested');
      expect(csv).toContain('key');
      expect(csv).toContain('value');
    });
  });

  describe('parseCSV', () => {
    it('should parse CSV string to array of objects', () => {
      const csv = '"name","age"\n"John","30"\n"Jane","25"';
      const result = parseCSV(csv);

      expect(result).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' },
      ]);
    });

    it('should handle CSV without headers', () => {
      const csv = '"John","30"\n"Jane","25"';
      const result = parseCSV(csv, { hasHeaders: false });

      expect(result).toEqual([
        { col0: 'John', col1: '30' },
        { col0: 'Jane', col1: '25' },
      ]);
    });

    it('should handle custom delimiter', () => {
      const csv = '"name";"age"\n"John";"30"';
      const result = parseCSV(csv, { delimiter: ';' });

      expect(result).toEqual([{ name: 'John', age: '30' }]);
    });

    it('should handle quoted fields with commas', () => {
      const csv = '"text"\n"Hello, World"';
      const result = parseCSV(csv);

      expect(result[0]!.text).toBe('Hello, World');
    });

    it('should handle escaped quotes', () => {
      const csv = '"text"\n"Say ""Hello"""';
      const result = parseCSV(csv);

      expect(result[0]!.text).toBe('Say "Hello"');
    });

    it('should return empty array for empty string', () => {
      expect(parseCSV('')).toEqual([]);
    });

    it('should handle Windows line endings', () => {
      const csv = '"name"\r\n"John"';
      const result = parseCSV(csv);

      expect(result).toEqual([{ name: 'John' }]);
    });
  });
});

/**
 * Data Converters for NextRush v2
 *
 * Provides data format conversion utilities (CSV, etc).
 *
 * @packageDocumentation
 */

/**
 * CSV conversion options
 */
export interface CsvOptions {
  /** Column delimiter (default: ',') */
  delimiter?: string;
  /** Include headers row (default: true) */
  includeHeaders?: boolean;
  /** Custom column headers */
  headers?: string[];
  /** Quote all fields (default: true) */
  quoteAll?: boolean;
  /** Line ending (default: '\n') */
  lineEnding?: string;
}

/**
 * Convert array of objects to CSV string
 *
 * @param data - Array of objects to convert
 * @param options - CSV conversion options
 * @returns CSV formatted string
 *
 * @example
 * ```typescript
 * const users = [
 *   { name: 'John', age: 30 },
 *   { name: 'Jane', age: 25 }
 * ];
 * const csv = convertToCSV(users);
 * // "name","age"
 * // "John","30"
 * // "Jane","25"
 * ```
 */
export function convertToCSV(data: unknown[], options: CsvOptions = {}): string {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  const {
    delimiter = ',',
    includeHeaders = true,
    headers: customHeaders,
    quoteAll = true,
    lineEnding = '\n',
  } = options;

  const firstRow = data[0] as Record<string, unknown>;
  const headers = customHeaders || Object.keys(firstRow);
  const rows: string[] = [];

  // Add headers row
  if (includeHeaders) {
    rows.push(formatRow(headers, delimiter, quoteAll));
  }

  // Add data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const value = (row as Record<string, unknown>)[header];
      return formatValue(value);
    });
    rows.push(formatRow(values, delimiter, quoteAll));
  }

  return rows.join(lineEnding);
}

/**
 * Format a single CSV row
 */
function formatRow(values: unknown[], delimiter: string, quoteAll: boolean): string {
  return values
    .map((value) => {
      const strValue = String(value ?? '');
      if (quoteAll || needsQuoting(strValue, delimiter)) {
        return `"${strValue.replace(/"/g, '""')}"`;
      }
      return strValue;
    })
    .join(delimiter);
}

/**
 * Format a single value for CSV
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Check if value needs quoting
 */
function needsQuoting(value: string, delimiter: string): boolean {
  return (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  );
}

/**
 * Parse CSV string to array of objects
 *
 * @param csv - CSV string to parse
 * @param options - Parse options
 * @returns Array of objects
 *
 * @example
 * ```typescript
 * const csv = '"name","age"\n"John","30"';
 * const data = parseCSV(csv);
 * // [{ name: 'John', age: '30' }]
 * ```
 */
export function parseCSV(
  csv: string,
  options: { delimiter?: string; hasHeaders?: boolean } = {}
): Record<string, string>[] {
  const { delimiter = ',', hasHeaders = true } = options;
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) {
    return [];
  }

  const parseRow = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  };

  const headers = hasHeaders ? parseRow(lines[0]!) : [];
  const startIndex = hasHeaders ? 1 : 0;
  const result: Record<string, string>[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const values = parseRow(lines[i]!);
    const row: Record<string, string> = {};

    if (hasHeaders) {
      headers.forEach((header, index) => {
        row[header] = values[index] ?? '';
      });
    } else {
      values.forEach((value, index) => {
        row[`col${index}`] = value;
      });
    }

    result.push(row);
  }

  return result;
}

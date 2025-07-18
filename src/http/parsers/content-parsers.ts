/**
 * 📄 JSON Parser - Handles JSON request bodies with validation
 */

import { BaseParser, ParseError } from './base-parser';

export interface JsonParserOptions {
  maxSize?: number;
  timeout?: number;
  strict?: boolean;
  reviver?: (key: string, value: any) => any;
  allowEmptyBody?: boolean;
}

export class JsonParser extends BaseParser<any> {
  private reviver: ((key: string, value: any) => any) | undefined;
  private allowEmptyBody: boolean;

  constructor(options: JsonParserOptions = {}) {
    super({
      maxSize: options.maxSize || 1024 * 1024, // 1MB
      timeout: options.timeout || 30000,
      strict: options.strict || false,
      encoding: 'utf8',
    });

    this.reviver = options.reviver;
    this.allowEmptyBody = options.allowEmptyBody ?? true;
  }

  protected async parseData(data: string, contentType: string): Promise<any> {
    // Validate content type
    if (this.options.strict && !this.isJsonContentType(contentType)) {
      throw new ParseError(`Expected JSON content type, got: ${contentType}`);
    }

    // Handle empty body
    if (!data.trim()) {
      if (this.allowEmptyBody) {
        return {};
      }
      throw new ParseError('Empty JSON body not allowed');
    }

    try {
      return JSON.parse(data, this.reviver);
    } catch (error) {
      throw new ParseError(
        `Invalid JSON: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  private isJsonContentType(contentType: string): boolean {
    return (
      contentType.includes('application/json') ||
      contentType.includes('text/json') ||
      contentType.includes('+json')
    );
  }

  /**
   * 🔍 Validate JSON schema (if provided)
   */
  validateSchema(data: any, schema: any): boolean {
    // Implement JSON schema validation here
    // This is a placeholder for future schema validation
    return true;
  }
}

/**
 * 🔗 URL-Encoded Parser - Handles form data
 */
export interface UrlEncodedParserOptions {
  maxSize?: number;
  timeout?: number;
  extended?: boolean;
  parameterLimit?: number;
  arrayLimit?: number;
}

export class UrlEncodedParser extends BaseParser<Record<string, any>> {
  private extended: boolean;
  private parameterLimit: number;
  private arrayLimit: number;

  constructor(options: UrlEncodedParserOptions = {}) {
    super({
      maxSize: options.maxSize || 1024 * 1024,
      timeout: options.timeout || 30000,
      encoding: 'utf8',
    });

    this.extended = options.extended ?? true;
    this.parameterLimit = options.parameterLimit || 1000;
    this.arrayLimit = options.arrayLimit || 100;
  }

  protected async parseData(
    data: string,
    contentType: string
  ): Promise<Record<string, any>> {
    if (!data.trim()) {
      return {};
    }

    if (this.extended) {
      return this.parseExtended(data);
    } else {
      return this.parseSimple(data);
    }
  }

  private parseSimple(data: string): Record<string, string> {
    const params: Record<string, string> = {};
    const pairs = data.split('&');

    if (pairs.length > this.parameterLimit) {
      throw new ParseError(
        `Too many parameters. Limit: ${this.parameterLimit}`
      );
    }

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = value
          ? decodeURIComponent(value.replace(/\+/g, ' '))
          : '';
      }
    }

    return params;
  }

  private parseExtended(data: string): Record<string, any> {
    const params: Record<string, any> = {};
    const pairs = data.split('&');

    if (pairs.length > this.parameterLimit) {
      throw new ParseError(
        `Too many parameters. Limit: ${this.parameterLimit}`
      );
    }

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        const decodedKey = decodeURIComponent(key);
        const decodedValue = value
          ? decodeURIComponent(value.replace(/\+/g, ' '))
          : '';

        this.setNestedValue(params, decodedKey, decodedValue);
      }
    }

    return params;
  }

  private setNestedValue(obj: any, key: string, value: string): void {
    // Handle arrays: key[0], key[]
    const arrayMatch = key.match(/^(.+)\[(\d*)\]$/);
    if (arrayMatch) {
      const [, arrayKey, index] = arrayMatch;

      if (!obj[arrayKey]) {
        obj[arrayKey] = [];
      }

      if (obj[arrayKey].length > this.arrayLimit) {
        throw new ParseError(`Array too large. Limit: ${this.arrayLimit}`);
      }

      if (index === '') {
        obj[arrayKey].push(value);
      } else {
        obj[arrayKey][parseInt(index, 10)] = value;
      }
      return;
    }

    // Handle nested objects: key[subkey]
    const nestedMatch = key.match(/^(.+)\[(.+)\]$/);
    if (nestedMatch) {
      const [, objectKey, subKey] = nestedMatch;

      if (!obj[objectKey]) {
        obj[objectKey] = {};
      }

      this.setNestedValue(obj[objectKey], subKey, value);
      return;
    }

    // Simple key-value
    obj[key] = value;
  }
}

/**
 * 📝 Text Parser - Handles plain text
 */
export class TextParser extends BaseParser<string> {
  protected async parseData(data: string): Promise<string> {
    return data;
  }
}

/**
 * 🔧 Raw Parser - Handles binary data
 */
export class RawParser extends BaseParser<Buffer> {
  protected override shouldReturnBuffer(): boolean {
    return true;
  }

  protected async parseData(data: Buffer): Promise<Buffer> {
    return data;
  }
}

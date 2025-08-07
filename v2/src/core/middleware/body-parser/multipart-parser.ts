/**
 * 🚀 Multipart Body Parser - NextRush v2
 *
 * Placeholder for multipart parser - will be fully implemented
 * Only loads when Content-Type: multipart/form-data is detected
 *
 * @author NextRush Framework Team
 * @version 2.0.0
 */

import type { BodyParseResult, BodyParser } from './types';

/**
 * ⚡ Basic multipart parser (placeholder)
 */
export class MultipartParser implements BodyParser {
  async parse(
    _rawData: Buffer,
    contentType: string
  ): Promise<Partial<BodyParseResult>> {
    return {
      data: { message: 'Multipart parsing not yet implemented' },
      contentType,
      parser: 'multipart',
      hasFiles: false,
      isEmpty: false,
      parseTime: 0,
    };
  }
}

let defaultMultipartParser: MultipartParser | null = null;

export function getMultipartParser(): MultipartParser {
  if (!defaultMultipartParser) {
    defaultMultipartParser = new MultipartParser();
  }
  return defaultMultipartParser;
}

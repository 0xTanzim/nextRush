/**
 * 📁 Multipart Parser - Handles file uploads and multipart/form-data
 * Zero-dependency implementation using Node.js built-ins
 */

import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { BaseParser, ParseError } from './base-parser';

export interface FileUpload {
  fieldname: string;
  filename: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
  encoding?: string;
}

export interface MultipartResult {
  fields: Record<string, string | string[]>;
  files: Record<string, FileUpload | FileUpload[]>;
}

export interface MultipartParserOptions {
  maxSize?: number;
  timeout?: number;
  maxFiles?: number;
  maxFileSize?: number;
  maxFieldSize?: number;
  maxFields?: number;
  uploadDir?: string;
  keepExtensions?: boolean;
  allowedMimeTypes?: string[];
  memoryStorage?: boolean;
}

export class MultipartParser extends BaseParser<MultipartResult> {
  private maxFiles: number;
  private maxFileSize: number;
  private maxFieldSize: number;
  private maxFields: number;
  private uploadDir: string;
  private keepExtensions: boolean;
  private allowedMimeTypes: string[];
  private memoryStorage: boolean;

  constructor(options: MultipartParserOptions = {}) {
    super({
      maxSize: options.maxSize || 50 * 1024 * 1024, // 50MB
      timeout: options.timeout || 60000, // 60 seconds for uploads
      encoding: 'binary',
    });

    this.maxFiles = options.maxFiles || 10;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB per file
    this.maxFieldSize = options.maxFieldSize || 1024 * 1024; // 1MB per field
    this.maxFields = options.maxFields || 100;
    this.uploadDir = options.uploadDir || tmpdir();
    this.keepExtensions = options.keepExtensions ?? true;
    this.allowedMimeTypes = options.allowedMimeTypes || [];
    this.memoryStorage = options.memoryStorage ?? true;
  }

  protected override shouldReturnBuffer(): boolean {
    return true;
  }

  protected async parseData(
    data: Buffer,
    contentType: string
  ): Promise<MultipartResult> {
    const boundary = this.getBoundary(contentType);
    if (!boundary) {
      throw new ParseError('Missing boundary in multipart content-type');
    }

    const parts = this.splitMultipart(data, boundary);
    const result: MultipartResult = { fields: {}, files: {} };

    let fileCount = 0;
    let fieldCount = 0;

    for (const part of parts) {
      const { headers, body } = this.parsePart(part);
      const disposition = this.parseContentDisposition(
        headers['content-disposition'] || ''
      );

      if (!disposition.name) continue;

      if (disposition.filename !== undefined) {
        // File upload
        if (fileCount >= this.maxFiles) {
          throw new ParseError(`Too many files. Maximum: ${this.maxFiles}`);
        }

        if (body.length > this.maxFileSize) {
          throw new ParseError(
            `File too large. Maximum: ${this.maxFileSize} bytes`
          );
        }

        if (!disposition.name) {
          throw new ParseError('File upload missing field name');
        }

        const file = await this.processFile(
          disposition as { name: string; filename?: string },
          headers,
          body
        );
        this.addFileToResult(result, disposition.name, file);
        fileCount++;
      } else {
        // Form field
        if (fieldCount >= this.maxFields) {
          throw new ParseError(`Too many fields. Maximum: ${this.maxFields}`);
        }

        if (body.length > this.maxFieldSize) {
          throw new ParseError(
            `Field too large. Maximum: ${this.maxFieldSize} bytes`
          );
        }

        const value = body.toString('utf8');
        this.addFieldToResult(result, disposition.name, value);
        fieldCount++;
      }
    }

    return result;
  }

  private getBoundary(contentType: string): string | null {
    const match = contentType.match(/boundary=([^;]+)/i);
    return match ? match[1].replace(/['"]/g, '') : null;
  }

  private splitMultipart(data: Buffer, boundary: string): Buffer[] {
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const endBoundaryBuffer = Buffer.from(`--${boundary}--`);
    const parts: Buffer[] = [];

    let start = 0;
    let end = data.indexOf(boundaryBuffer, start);

    while (end !== -1) {
      if (start > 0) {
        // Extract part (skip the boundary and CRLF)
        const partStart = start + boundaryBuffer.length;
        const crlfIndex = data.indexOf(Buffer.from('\r\n'), partStart);
        if (crlfIndex !== -1) {
          const partData = data.slice(crlfIndex + 2, end - 2); // -2 for CRLF before boundary
          if (partData.length > 0) {
            parts.push(partData);
          }
        }
      }

      start = end;
      end = data.indexOf(boundaryBuffer, start + boundaryBuffer.length);
    }

    return parts;
  }

  private parsePart(part: Buffer): {
    headers: Record<string, string>;
    body: Buffer;
  } {
    const headerEndIndex = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEndIndex === -1) {
      throw new ParseError('Invalid multipart part: no header separator');
    }

    const headerSection = part.slice(0, headerEndIndex).toString('utf8');
    const body = part.slice(headerEndIndex + 4);

    const headers: Record<string, string> = {};
    const headerLines = headerSection.split('\r\n');

    for (const line of headerLines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const name = line.slice(0, colonIndex).trim().toLowerCase();
        const value = line.slice(colonIndex + 1).trim();
        headers[name] = value;
      }
    }

    return { headers, body };
  }

  private parseContentDisposition(disposition: string): {
    name?: string;
    filename?: string;
  } {
    const result: { name?: string; filename?: string } = {};

    // Parse name
    const nameMatch = disposition.match(/name="?([^"]+)"?/);
    if (nameMatch) {
      result.name = nameMatch[1];
    }

    // Parse filename
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch) {
      result.filename = filenameMatch[1];
    }

    return result;
  }

  private async processFile(
    disposition: { name: string; filename?: string },
    headers: Record<string, string>,
    body: Buffer
  ): Promise<FileUpload> {
    const filename = disposition.filename || 'unknown';
    const mimetype = headers['content-type'] || 'application/octet-stream';

    // Validate MIME type if restrictions are set
    if (
      this.allowedMimeTypes.length > 0 &&
      !this.allowedMimeTypes.includes(mimetype)
    ) {
      throw new ParseError(`File type not allowed: ${mimetype}`);
    }

    const file: FileUpload = {
      fieldname: disposition.name,
      filename,
      mimetype,
      size: body.length,
      encoding: headers['content-transfer-encoding'] || 'binary',
    };

    if (this.memoryStorage) {
      // Store in memory
      file.buffer = body;
    } else {
      // Store to disk
      const tempFilename = this.generateTempFilename(filename);
      const tempPath = join(this.uploadDir, tempFilename);

      await fs.writeFile(tempPath, body);
      file.path = tempPath;
    }

    return file;
  }

  private generateTempFilename(originalFilename: string): string {
    const randomId = randomBytes(16).toString('hex');

    if (this.keepExtensions) {
      const extension = originalFilename.split('.').pop();
      return extension ? `${randomId}.${extension}` : randomId;
    }

    return randomId;
  }

  private addFileToResult(
    result: MultipartResult,
    fieldname: string,
    file: FileUpload
  ): void {
    const existing = result.files[fieldname];

    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(file);
      } else {
        result.files[fieldname] = [existing, file];
      }
    } else {
      result.files[fieldname] = file;
    }
  }

  private addFieldToResult(
    result: MultipartResult,
    fieldname: string,
    value: string
  ): void {
    const existing = result.fields[fieldname];

    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result.fields[fieldname] = [existing, value];
      }
    } else {
      result.fields[fieldname] = value;
    }
  }

  /**
   * 🧹 Cleanup temporary files
   */
  async cleanup(
    files: Record<string, FileUpload | FileUpload[]>
  ): Promise<void> {
    for (const fileOrFiles of Object.values(files)) {
      const fileList = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];

      for (const file of fileList) {
        if (file.path) {
          try {
            await fs.unlink(file.path);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    }
  }
}

import { access, readFile, stat } from 'fs/promises';
import { ServerResponse } from 'node:http';
import * as path from 'path';
import { ContentType, FinishedResponse, Response } from '../types';
import {
  FileSystemError,
  LitePressError,
  NotFoundError,
  ValidationError,
} from '../types/Errors';
import { ContentTypeUtil } from '../utils';

export class ResponseHandler {
  static enhanceResponse(res: ServerResponse): Response {
    const response = res as Response;

    response.status = function (code: number): Response {
      try {
        if (this.headersSent) {
          throw new LitePressError(
            'Cannot set status after headers have been sent',
            'HEADERS_SENT',
            500
          );
        }

        if (!Number.isInteger(code) || code < 100 || code > 599) {
          throw new ValidationError(
            `Invalid status code: ${code}. Must be between 100-599`,
            { statusCode: code }
          );
        }

        this.statusCode = code;
        return this;
      } catch (error) {
        console.error('Error setting status code:', error);
        throw error;
      }
    };

    response.json = function (
      data: unknown,
      status: number = 200
    ): FinishedResponse {
      try {
        if (this.headersSent) {
          throw new LitePressError(
            'Cannot send JSON after headers have been sent',
            'HEADERS_SENT',
            500
          );
        }

        this.status(status);
        this.setHeader('Content-Type', 'application/json');

        let jsonString: string;
        try {
          jsonString = JSON.stringify(data);
        } catch (jsonError) {
          throw new LitePressError(
            'Failed to serialize data to JSON',
            'JSON_SERIALIZATION_ERROR',
            500,
            {
              error: (jsonError as Error).message,
              dataType: typeof data,
            }
          );
        }

        this.end(jsonString);
        return this as FinishedResponse;
      } catch (error) {
        console.error('Error sending JSON response:', error);

        // Try to send error response if headers not sent
        if (!this.headersSent) {
          try {
            this.statusCode = 500;
            this.setHeader('Content-Type', 'application/json');
            this.end(
              JSON.stringify({
                error: 'Internal Server Error',
                message: (error as Error).message,
              })
            );
          } catch (fallbackError) {
            console.error('Failed to send error response:', fallbackError);
          }
        }

        throw error;
      }
    };

    response.send = function (
      data: string,
      status: number = 200,
      contentType: ContentType = 'application/json'
    ): FinishedResponse {
      try {
        if (this.headersSent) {
          throw new LitePressError(
            'Cannot send data after headers have been sent',
            'HEADERS_SENT',
            500
          );
        }

        if (typeof data !== 'string') {
          throw new ValidationError('Data must be a string for send() method', {
            dataType: typeof data,
          });
        }

        this.status(status);
        this.setHeader('Content-Type', contentType);
        this.end(data);
        return this as FinishedResponse;
      } catch (error) {
        console.error('Error sending response:', error);

        // Try to send error response if headers not sent
        if (!this.headersSent) {
          try {
            this.statusCode = 500;
            this.setHeader('Content-Type', 'text/plain');
            this.end('Internal Server Error');
          } catch (fallbackError) {
            console.error('Failed to send error response:', fallbackError);
          }
        }

        throw error;
      }
    };

    response.serveHtmlFile = async (
      relativePath: string,
      status = 200
    ): Promise<FinishedResponse> => {
      try {
        await ResponseHandler.serveFile(response, relativePath, status);
        return response as FinishedResponse;
      } catch (error) {
        console.error('Error serving HTML file:', error);
        throw error;
      }
    };

    return response;
  }

  static async serveFile(
    res: Response,
    relativePath: string,
    status = 200
  ): Promise<void> {
    try {
      // Validate inputs
      if (!relativePath || typeof relativePath !== 'string') {
        throw new ValidationError('File path must be a non-empty string');
      }

      if (res.headersSent) {
        throw new LitePressError(
          'Cannot serve file after headers have been sent',
          'HEADERS_SENT',
          500
        );
      }

      // Security: prevent directory traversal
      const normalizedPath = path.normalize(relativePath);
      if (normalizedPath.includes('..')) {
        throw new LitePressError(
          'Directory traversal not allowed',
          'SECURITY_VIOLATION',
          403,
          { path: relativePath }
        );
      }

      const fullPath = path.join(__dirname, normalizedPath);

      try {
        // Check if file exists and is accessible
        await access(fullPath);

        // Get file stats
        const stats = await stat(fullPath);

        if (!stats.isFile()) {
          throw new NotFoundError('File');
        }

        // Check file size (prevent serving huge files)
        const maxFileSize = 50 * 1024 * 1024; // 50MB limit
        if (stats.size > maxFileSize) {
          throw new LitePressError(
            'File too large to serve',
            'FILE_TOO_LARGE',
            413,
            {
              fileSize: stats.size,
              maxSize: maxFileSize,
              path: relativePath,
            }
          );
        }

        // Read file
        const fileContent = await readFile(fullPath, 'utf-8');
        const contentType = ContentTypeUtil.getContentType(fullPath);

        // Set additional headers
        res.setHeader(
          'Content-Length',
          Buffer.byteLength(fileContent, 'utf-8')
        );
        res.setHeader('Last-Modified', stats.mtime.toUTCString());

        res.send(fileContent, status, contentType);
      } catch (fileError: any) {
        if (fileError.code === 'ENOENT') {
          throw new NotFoundError(`File: ${relativePath}`);
        } else if (fileError.code === 'EACCES') {
          throw new LitePressError(
            'Permission denied accessing file',
            'PERMISSION_DENIED',
            403,
            { path: relativePath }
          );
        } else if (fileError.code === 'EISDIR') {
          throw new LitePressError(
            'Path is a directory, not a file',
            'IS_DIRECTORY',
            400,
            { path: relativePath }
          );
        } else {
          throw new FileSystemError('read file', relativePath, fileError);
        }
      }
    } catch (error) {
      console.error('Error serving file:', error);

      // Try to send error response if headers not sent
      if (!res.headersSent) {
        try {
          if (error instanceof LitePressError) {
            res.status(error.statusCode).json({
              error: error.message,
              code: error.code,
              details: error.details,
            });
          } else {
            res.status(500).json({
              error: 'Failed to serve file',
              message: (error as Error).message,
            });
          }
        } catch (responseError) {
          console.error('Failed to send file error response:', responseError);
        }
      }

      throw error;
    }
  }

  static isResponseFinished(res: Response): boolean {
    return res.headersSent || res.destroyed || res.writableEnded;
  }

  static safeEndResponse(res: Response, data?: string): void {
    try {
      if (!this.isResponseFinished(res)) {
        if (data) {
          res.end(data);
        } else {
          res.end();
        }
      }
    } catch (error) {
      console.error('Error ending response:', error);
    }
  }
}

import {
  PayloadTooLargeError,
  TimeoutError,
  UnsupportedMediaTypeError,
  ValidationError,
  ZestfxError,
} from '../types/Errors';
import { Request } from '../types/Request';

export interface BodyParserOptions {
  maxSize?: number;
  timeout?: number;
  allowedContentTypes?: string[];
  strict?: boolean;
}

export class BodyParser {
  private static defaultOptions: BodyParserOptions = {
    maxSize: 1024 * 1024, // 1MB
    timeout: 30000, // 30 seconds
    allowedContentTypes: [
      'application/json',
      'application/x-www-form-urlencoded',
      'text/plain',
      'application/octet-stream',
      'multipart/form-data',
    ],
    strict: false,
  };

  static async parseBody(
    req: Request,
    options?: BodyParserOptions
  ): Promise<unknown> {
    const config = { ...this.defaultOptions, ...options };
    const contentType = req.headers['content-type'] || 'application/json';
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    try {
      // Validate content length
      if (contentLength > config.maxSize!) {
        throw new PayloadTooLargeError(config.maxSize!, contentLength);
      }

      // Validate content type if strict mode is enabled
      if (config.strict && config.allowedContentTypes) {
        const isAllowed = config.allowedContentTypes.some((type) =>
          contentType.toLowerCase().includes(type.toLowerCase())
        );
        if (!isAllowed) {
          throw new UnsupportedMediaTypeError(
            contentType,
            config.allowedContentTypes
          );
        }
      }

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let totalSize = 0;
        let timeoutId: NodeJS.Timeout | null = null;

        // Set up timeout
        if (config.timeout) {
          timeoutId = setTimeout(() => {
            req.destroy();
            reject(new TimeoutError('Body parsing', config.timeout!));
          }, config.timeout);
        }

        const cleanup = () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        };

        req.on('data', (chunk: Buffer) => {
          try {
            totalSize += chunk.length;

            // Check size during streaming
            if (totalSize > config.maxSize!) {
              cleanup();
              req.destroy();
              reject(new PayloadTooLargeError(config.maxSize!, totalSize));
              return;
            }

            chunks.push(chunk);
          } catch (error) {
            cleanup();
            reject(
              new ZestfxError(
                'Error processing request chunk',
                'CHUNK_PROCESSING_ERROR',
                400,
                { error: (error as Error).message }
              )
            );
          }
        });

        req.on('end', () => {
          cleanup();

          try {
            const raw = Buffer.concat(chunks);
            const bodyStr = raw.toString('utf8');

            // Parse based on content type
            if (contentType.includes('application/json')) {
              if (!bodyStr.trim()) {
                resolve({});
                return;
              }

              try {
                const parsed = JSON.parse(bodyStr);
                resolve(parsed);
              } catch (jsonError) {
                reject(
                  new ValidationError('Invalid JSON in request body', {
                    contentType,
                    bodyPreview: bodyStr.substring(0, 100),
                    jsonError: (jsonError as Error).message,
                  })
                );
              }
            } else if (
              contentType.includes('application/x-www-form-urlencoded')
            ) {
              try {
                const result: Record<string, string> = {};
                if (bodyStr.trim()) {
                  bodyStr.split('&').forEach((pair) => {
                    const [key, value] = pair.split('=');
                    if (key) {
                      try {
                        result[decodeURIComponent(key)] = decodeURIComponent(
                          value || ''
                        );
                      } catch (decodeError) {
                        throw new ValidationError(
                          'Invalid URL encoding in form data',
                          { pair, error: (decodeError as Error).message }
                        );
                      }
                    }
                  });
                }
                resolve(result);
              } catch (error) {
                reject(error);
              }
            } else if (contentType.includes('text/plain')) {
              resolve(bodyStr);
            } else if (contentType.includes('application/octet-stream')) {
              resolve(raw);
            } else if (contentType.includes('multipart/form-data')) {
              // Basic multipart support - could be enhanced with a proper parser
              resolve({
                _raw: raw,
                _contentType: contentType,
                _note: 'Multipart parsing requires additional implementation',
              });
            } else {
              // Fallback for unknown content types
              if (config.strict) {
                reject(
                  new UnsupportedMediaTypeError(
                    contentType,
                    config.allowedContentTypes
                  )
                );
              } else {
                resolve(bodyStr);
              }
            }
          } catch (error) {
            reject(
              new ZestfxError(
                'Error parsing request body',
                'BODY_PARSING_ERROR',
                400,
                {
                  contentType,
                  error: (error as Error).message,
                  bodySize: totalSize,
                }
              )
            );
          }
        });

        req.on('error', (error) => {
          cleanup();
          reject(
            new ZestfxError(
              'Request stream error',
              'REQUEST_STREAM_ERROR',
              400,
              { error: error.message }
            )
          );
        });

        req.on('aborted', () => {
          cleanup();
          reject(
            new ZestfxError('Request was aborted', 'REQUEST_ABORTED', 400)
          );
        });
      });
    } catch (error) {
      throw error;
    }
  }

  static configure(options: BodyParserOptions): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }
}

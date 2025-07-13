import { ServerResponse } from 'node:http';
import { ContentType } from '../../types/http';

export interface EnhancedResponse extends ServerResponse {
  status(code: number): EnhancedResponse;
  json(data: unknown, status?: number): void;
  send(data: string, status?: number, contentType?: ContentType): void;
  serveFile(filePath: string, status?: number): Promise<void>;
}

export interface FileServerConfig {
  maxFileSize?: number;
  allowedExtensions?: string[];
  cacheHeaders?: boolean;
}

export interface ResponseConfig {
  fileServer?: FileServerConfig;
  defaultHeaders?: Record<string, string>;
}

// Common types used across the application
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'OPTIONS'
  | 'HEAD';

export type Path = string | RegExp;

export type ContentType =
  | 'application/json'
  | 'application/xml'
  | 'text/html'
  | 'text/plain'
  | 'text/css'
  | 'text/javascript'
  | 'application/octet-stream'
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/svg+xml'
  | string;

export interface ServerConfig {
  port?: number;
  host?: string;
  timeout?: number;
  maxBodySize?: number;
  corsEnabled?: boolean;
  corsOrigins?: string[];
  environment?: 'development' | 'production' | 'test';
}

export interface LoggerConfig {
  enabled?: boolean;
  level?: 'debug' | 'info' | 'warn' | 'error';
  includeStack?: boolean;
}

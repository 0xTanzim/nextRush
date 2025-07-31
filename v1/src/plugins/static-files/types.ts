/**
 * 📁 Static Files Types & Interfaces
 * Core type definitions for NextRush Static Files system
 */

import * as fs from 'fs';
import { NextRushResponse } from '../../types/express';

/**
 * Static file serving options
 */
export interface StaticOptions {
  // Cache control
  maxAge?: string | number;
  immutable?: boolean;
  etag?: boolean;
  lastModified?: boolean;

  // File serving
  index?: string | string[] | false;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  extensions?: string[] | false;
  redirect?: boolean;

  // Performance
  compress?: 'gzip' | 'brotli' | 'auto' | boolean;
  precompress?: boolean;
  memoryCache?: boolean;
  maxCacheSize?: number;
  maxFileSize?: number;
  acceptRanges?: boolean;

  // Security
  serveHidden?: boolean;
  caseSensitive?: boolean;

  // SPA support
  spa?: boolean | string;

  // Custom headers
  setHeaders?: (res: NextRushResponse, path: string, stat: fs.Stats) => void;
}

/**
 * Static mount configuration
 */
export interface StaticMount {
  mountPath: string;
  rootPath: string;
  options: StaticOptions;
}

/**
 * Cache entry for optimized serving
 */
export interface CacheEntry {
  content: Buffer;
  compressed?: {
    gzip?: Buffer;
    brotli?: Buffer;
  };
  mimeType: string;
  etag: string;
  lastModified: Date;
  size: number;
  compressible: boolean;
  encoding?: string;
}

/**
 * Range request information
 */
export interface RangeInfo {
  start: number;
  end: number;
  total: number;
  chunkSize: number;
}

/**
 * Static files statistics
 */
export interface StaticStats {
  totalRequests: number;
  cacheHits: number;
  compressionHits: number;
  bytesServed: number;
  filesCached: number;
  cacheSize: number;
  mounts: number;
  uptime: number;
}

/**
 * Compression settings
 */
export interface CompressionOptions {
  type: 'gzip' | 'brotli' | 'auto';
  threshold: number;
  level?: number;
}

/**
 * Default static file options
 */
export const DEFAULT_STATIC_OPTIONS: Required<
  Omit<StaticOptions, 'setHeaders'>
> = {
  maxAge: '1d',
  immutable: false,
  etag: true,
  lastModified: true,
  index: ['index.html'],
  dotfiles: 'ignore',
  extensions: false,
  redirect: true,
  compress: 'auto',
  precompress: false,
  memoryCache: true,
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  maxFileSize: 2 * 1024 * 1024, // 2MB
  acceptRanges: true,
  serveHidden: false,
  caseSensitive: true,
  spa: false,
};

/**
 * Compression threshold (1KB)
 */
export const COMPRESSION_THRESHOLD = 1024;

/**
 * Common compressible MIME types
 */
export const COMPRESSIBLE_TYPES = new Set([
  'text/html',
  'text/css',
  'text/plain',
  'text/xml',
  'text/javascript',
  'text/markdown',
  'application/javascript',
  'application/json',
  'application/xml',
  'application/rss+xml',
  'application/atom+xml',
  'image/svg+xml',
]);

/**
 * Comprehensive MIME type mappings
 */
export const MIME_TYPES = new Map([
  // Text
  ['.html', 'text/html'],
  ['.htm', 'text/html'],
  ['.css', 'text/css'],
  ['.js', 'application/javascript'],
  ['.mjs', 'application/javascript'],
  ['.json', 'application/json'],
  ['.xml', 'application/xml'],
  ['.txt', 'text/plain'],
  ['.md', 'text/markdown'],
  ['.csv', 'text/csv'],

  // Images
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.bmp', 'image/bmp'],
  ['.tiff', 'image/tiff'],
  ['.avif', 'image/avif'],

  // Audio/Video
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.avi', 'video/x-msvideo'],
  ['.mov', 'video/quicktime'],
  ['.wmv', 'video/x-ms-wmv'],
  ['.flv', 'video/x-flv'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.flac', 'audio/flac'],
  ['.ogg', 'audio/ogg'],
  ['.m4a', 'audio/mp4'],

  // Documents
  ['.pdf', 'application/pdf'],
  ['.doc', 'application/msword'],
  [
    '.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  ['.xls', 'application/vnd.ms-excel'],
  [
    '.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  ['.ppt', 'application/vnd.ms-powerpoint'],
  [
    '.pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],

  // Archives
  ['.zip', 'application/zip'],
  ['.rar', 'application/vnd.rar'],
  ['.7z', 'application/x-7z-compressed'],
  ['.tar', 'application/x-tar'],
  ['.gz', 'application/gzip'],
  ['.bz2', 'application/x-bzip2'],

  // Fonts
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
  ['.eot', 'application/vnd.ms-fontobject'],

  // Application
  ['.wasm', 'application/wasm'],
  ['.jar', 'application/java-archive'],
  ['.war', 'application/java-archive'],
]);

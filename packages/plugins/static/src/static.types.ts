/**
 * @nextrush/static - Type Definitions
 *
 * Types for static file serving middleware.
 *
 * @packageDocumentation
 */

import type { Context } from '@nextrush/types';

/**
 * Policy for handling dotfiles (files starting with .)
 *
 * - 'ignore': Return 404 (default)
 * - 'deny': Return 403
 * - 'allow': Serve normally
 */
export type DotfilesPolicy = 'ignore' | 'deny' | 'allow';

/**
 * File system stats-like interface
 */
export interface StatsLike {
  /** File size in bytes */
  size: number;
  /** Last modification time */
  mtime: Date;
  /** Check if entry is a file */
  isFile(): boolean;
  /** Check if entry is a directory */
  isDirectory(): boolean;
}

/**
 * Options for static file middleware
 */
export interface StaticOptions {
  /**
   * Root directory to serve files from (absolute path)
   * @required
   */
  root: string;

  /**
   * URL prefix to mount under
   * @default '' (serve from root)
   * @example '/static' - serve at /static/*
   */
  prefix?: `/${string}` | '';

  /**
   * Default index file for directories
   * @default 'index.html'
   * Set to `false` to disable index serving
   */
  index?: string | false;

  /**
   * If true, pass requests to next middleware on 404
   * If false, respond with 404 error
   * @default false
   */
  fallthrough?: boolean;

  /**
   * Redirect directory requests without trailing slash
   * @default true
   */
  redirect?: boolean;

  /**
   * Cache-Control max-age in seconds
   * @default 0 (no caching)
   */
  maxAge?: number;

  /**
   * Add 'immutable' directive to Cache-Control
   * Only applies when maxAge > 0
   * @default false
   */
  immutable?: boolean;

  /**
   * How to handle dotfiles
   * @default 'ignore'
   */
  dotfiles?: DotfilesPolicy;

  /**
   * File extensions to try when file not found
   * @default []
   * @example ['.html', '.htm'] - /page -> /page.html
   */
  extensions?: string[];

  /**
   * Custom headers hook
   * Called before sending file to customize headers
   */
  setHeaders?: (ctx: Context, absolutePath: string, stat: StatsLike) => void;

  /**
   * Enable ETag generation for conditional requests
   * @default true
   */
  etag?: boolean;

  /**
   * Enable Last-Modified header
   * @default true
   */
  lastModified?: boolean;

  /**
   * Enable Accept-Ranges header for range requests
   * @default true
   */
  acceptRanges?: boolean;

  /**
   * Maximum byte size for single-pass serving (avoid streaming for small files)
   * @default 1048576 (1MB)
   */
  highWaterMark?: number;
}

/**
 * Normalized options with defaults applied
 */
export interface NormalizedStaticOptions {
  root: string;
  prefix: string;
  index: string | false;
  fallthrough: boolean;
  redirect: boolean;
  maxAge: number;
  immutable: boolean;
  dotfiles: DotfilesPolicy;
  extensions: string[];
  setHeaders?: (ctx: Context, absolutePath: string, stat: StatsLike) => void;
  etag: boolean;
  lastModified: boolean;
  acceptRanges: boolean;
  highWaterMark: number;
}

/**
 * Range request result
 */
export interface RangeResult {
  start: number;
  end: number;
}

/**
 * Extended context with static file properties
 */
export interface StaticContext extends Context {
  /** Static file being served (set by middleware) */
  staticFile?: {
    path: string;
    stat: StatsLike;
  };
}

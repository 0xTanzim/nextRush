/**
 * Path utilities for NextRush v2
 *
 * @packageDocumentation
 */

import { existsSync, statSync } from 'node:fs';
import {
  basename,
  dirname,
  extname,
  join,
  normalize,
  resolve,
} from 'node:path';
import { cwd } from 'node:process';

/**
 * Resolve a path relative to the project root
 *
 * @param path - Path to resolve
 * @returns Absolute path
 */
export function resolvePath(path: string): string {
  return resolve(cwd(), path);
}

/**
 * Join multiple path segments
 *
 * @param paths - Path segments to join
 * @returns Joined path
 */
export function joinPaths(...paths: string[]): string {
  return join(...paths);
}

/**
 * Normalize a path
 *
 * @param path - Path to normalize
 * @returns Normalized path
 */
export function normalizePath(path: string): string {
  return normalize(path);
}

/**
 * Get file extension
 *
 * @param path - File path
 * @returns File extension
 */
export function getFileExtension(path: string): string {
  return extname(path);
}

/**
 * Get file name without extension
 *
 * @param path - File path
 * @returns File name without extension
 */
export function getFileName(path: string): string {
  return basename(path, extname(path));
}

/**
 * Get directory name
 *
 * @param path - File path
 * @returns Directory name
 */
export function getDirName(path: string): string {
  return dirname(path);
}

/**
 * Check if path exists
 *
 * @param path - Path to check
 * @returns True if path exists
 */
export function pathExists(path: string): boolean {
  return existsSync(path);
}

/**
 * Check if path is a file
 *
 * @param path - Path to check
 * @returns True if path is a file
 */
export function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

/**
 * Check if path is a directory
 *
 * @param path - Path to check
 * @returns True if path is a directory
 */
export function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

/**
 * Get file size in bytes
 *
 * @param path - File path
 * @returns File size in bytes
 */
export function getFileSize(path: string): number {
  if (!isFile(path)) {
    throw new Error(`Path is not a file: ${path}`);
  }
  return statSync(path).size;
}

/**
 * Get file modification time
 *
 * @param path - File path
 * @returns File modification time
 */
export function getFileModifiedTime(path: string): Date {
  if (!isFile(path)) {
    throw new Error(`Path is not a file: ${path}`);
  }
  return statSync(path).mtime;
}

/**
 * Ensure directory exists
 *
 * @param path - Directory path
 */
export function ensureDirectory(path: string): void {
  if (!existsSync(path)) {
    // This would require fs.mkdirSync with recursive option
    // For now, we'll just check if it exists
    throw new Error(`Directory does not exist: ${path}`);
  }
}

/**
 * Get relative path from base
 *
 * @param base - Base path
 * @param path - Path to make relative
 * @returns Relative path
 */
export function getRelativePath(base: string, path: string): string {
  const resolvedBase = resolve(base);
  const resolvedPath = resolve(path);

  if (resolvedPath.startsWith(resolvedBase)) {
    return resolvedPath.slice(resolvedBase.length + 1);
  }

  return path;
}

/**
 * Get absolute path
 *
 * @param path - Path to resolve
 * @returns Absolute path
 */
export function getAbsolutePath(path: string): string {
  return resolve(path);
}

/**
 * Check if path is absolute
 *
 * @param path - Path to check
 * @returns True if path is absolute
 */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || path.match(/^[A-Z]:/i) !== null;
}

/**
 * Get common path prefix
 *
 * @param paths - Array of paths
 * @returns Common prefix
 */
export function getCommonPrefix(paths: string[]): string {
  if (paths.length === 0) return '';
  if (paths.length === 1) {
    const firstPath = paths[0];
    return firstPath ? dirname(firstPath) : '';
  }

  const normalizedPaths = paths.map(normalize);
  let commonPrefix = normalizedPaths[0];

  for (let i = 1; i < normalizedPaths.length; i++) {
    const path = normalizedPaths[i];
    if (!path || !commonPrefix) continue;

    let j = 0;

    while (
      j < commonPrefix.length &&
      j < path.length &&
      commonPrefix[j] === path[j]
    ) {
      j++;
    }

    commonPrefix = commonPrefix.slice(0, j);
  }

  return commonPrefix || '';
}

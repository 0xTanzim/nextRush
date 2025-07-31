/**
 * 🔒 Static Files Security Handler
 * Comprehensive security features for static file serving
 */

import * as path from 'path';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { StaticOptions } from './types';

/**
 * Security handler for static files
 */
export class SecurityHandler {
  /**
   * Validate file path for security
   */
  isPathSafe(filePath: string, rootPath: string): boolean {
    try {
      const resolvedFilePath = path.resolve(filePath);
      const resolvedRootPath = path.resolve(rootPath);

      // Ensure the resolved path is within the root directory
      return (
        resolvedFilePath.startsWith(resolvedRootPath + path.sep) ||
        resolvedFilePath === resolvedRootPath
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if dotfile access is allowed
   */
  isDotfileAllowed(filePath: string, options: StaticOptions): boolean {
    const basename = path.basename(filePath);

    if (!basename.startsWith('.')) {
      return true; // Not a dotfile
    }

    switch (options.dotfiles) {
      case 'allow':
        return true;
      case 'deny':
        return false;
      case 'ignore':
      default:
        return false;
    }
  }

  /**
   * Check if hidden file serving is allowed
   */
  isHiddenFileAllowed(filePath: string, options: StaticOptions): boolean {
    if (options.serveHidden) {
      return true;
    }

    // Check for hidden files (starting with .)
    const parts = filePath.split(path.sep);
    return !parts.some(
      (part) => part.startsWith('.') && part !== '.' && part !== '..'
    );
  }

  /**
   * Set security headers for response
   */
  setSecurityHeaders(
    res: NextRushResponse,
    mimeType: string,
    options: StaticOptions
  ): void {
    // Always set X-Content-Type-Options
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Set additional headers based on content type
    if (mimeType === 'text/html') {
      // Prevent XSS attacks
      res.setHeader('X-XSS-Protection', '1; mode=block');

      // Prevent clickjacking
      res.setHeader('X-Frame-Options', 'DENY');

      // Content Security Policy (basic)
      res.setHeader('Content-Security-Policy', "default-src 'self'");
    }

    // Set referrer policy for sensitive content
    if (this.isSensitiveContent(mimeType)) {
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    // Prevent caching of sensitive files
    if (this.isPrivateContent(mimeType)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
  }

  /**
   * Validate request headers for security
   */
  validateRequest(req: NextRushRequest): { valid: boolean; reason?: string } {
    // Check for suspicious patterns in URL
    const url = req.url || '';

    // Block directory traversal attempts
    if (url.includes('../') || url.includes('..\\') || url.includes('%2e%2e')) {
      return { valid: false, reason: 'Directory traversal attempt' };
    }

    // Block null bytes
    if (url.includes('\0') || url.includes('%00')) {
      return { valid: false, reason: 'Null byte in path' };
    }

    // Block extremely long paths
    if (url.length > 2048) {
      return { valid: false, reason: 'Path too long' };
    }

    // Check for suspicious file extensions in query
    const suspiciousExts = [
      '.php',
      '.asp',
      '.jsp',
      '.cgi',
      '.sh',
      '.bat',
      '.cmd',
    ];
    if (suspiciousExts.some((ext) => url.toLowerCase().includes(ext))) {
      return { valid: false, reason: 'Suspicious file extension' };
    }

    return { valid: true };
  }

  /**
   * Check if file extension is dangerous
   */
  isDangerousExtension(filePath: string): boolean {
    const dangerousExts = [
      '.exe',
      '.bat',
      '.cmd',
      '.com',
      '.scr',
      '.vbs',
      '.js',
      '.jar',
      '.php',
      '.asp',
      '.aspx',
      '.jsp',
      '.cgi',
      '.pl',
      '.py',
      '.rb',
      '.sh',
      '.ps1',
      '.psm1',
      '.psd1',
    ];

    const ext = path.extname(filePath).toLowerCase();
    return dangerousExts.includes(ext);
  }

  /**
   * Generate Content Security Policy for static files
   */
  generateCSP(mimeType: string): string | null {
    if (mimeType === 'text/html') {
      return "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:";
    }

    return null;
  }

  /**
   * Check for malicious patterns in file path
   */
  hasMaliciousPatterns(filePath: string): boolean {
    const maliciousPatterns = [
      /\.\.[\\/]/, // Directory traversal
      /^[\\/]/, // Absolute path
      /\0/, // Null byte
      /[\x00-\x1f\x7f-\x9f]/, // Control characters
      /[<>:"|?*]/, // Invalid filename characters on Windows
    ];

    return maliciousPatterns.some((pattern) => pattern.test(filePath));
  }

  /**
   * Sanitize file path
   */
  sanitizePath(filePath: string): string {
    return filePath
      .replace(/\.\./g, '') // Remove directory traversal
      .replace(/[<>:"|?*\x00-\x1f\x7f-\x9f]/g, '') // Remove dangerous chars
      .replace(/^[\\/]+/, '') // Remove leading slashes
      .trim();
  }

  /**
   * Check if content type is sensitive
   */
  private isSensitiveContent(mimeType: string): boolean {
    const sensitiveTypes = [
      'text/html',
      'application/javascript',
      'text/javascript',
      'application/json',
      'text/xml',
      'application/xml',
    ];

    return sensitiveTypes.includes(mimeType);
  }

  /**
   * Check if content should not be cached
   */
  private isPrivateContent(mimeType: string): boolean {
    // Files that might contain sensitive information
    const privateTypes = [
      'application/json', // API responses
      'text/xml', // XML data
      'application/xml', // XML data
    ];

    return privateTypes.includes(mimeType);
  }

  /**
   * Rate limiting check (basic implementation)
   */
  checkRateLimit(req: NextRushRequest): {
    allowed: boolean;
    remaining?: number;
  } {
    // Basic rate limiting based on IP
    // In production, you'd want to use a more sophisticated rate limiter
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    // For now, just return allowed - can be extended with actual rate limiting
    return { allowed: true };
  }

  /**
   * Log security events
   */
  logSecurityEvent(event: string, req: NextRushRequest, details?: any): void {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    console.warn(`[StaticFiles Security] ${event}`, {
      ip,
      url: req.url,
      userAgent,
      timestamp: new Date().toISOString(),
      details,
    });
  }
}

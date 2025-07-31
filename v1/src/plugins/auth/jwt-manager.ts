/**
 * 🔑 JWT Manager - NextRush Framework
 *
 * High-performance JWT token handling with signing, verification, and validation.
 */

import * as crypto from 'crypto';
import { JwtOptions, JwtPayload } from './interfaces';

/**
 * JWT Manager for token operations
 */
export class JwtManager {
  private config: JwtOptions;

  constructor(config: JwtOptions) {
    this.config = { ...config };
    this.validateConfig();
  }

  /**
   * Sign JWT token with payload
   */
  sign(
    payload: Record<string, unknown>,
    options?: Partial<JwtOptions>
  ): string {
    const config = { ...this.config, ...options };
    const now = Math.floor(Date.now() / 1000);

    const jwtPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + this.parseExpiry(config.expiresIn || '1h'),
    };

    if (config.issuer) jwtPayload.iss = config.issuer;
    if (config.audience) jwtPayload.aud = config.audience;
    if (config.notBefore)
      jwtPayload.nbf = now + this.parseExpiry(config.notBefore);

    return this.createToken(
      jwtPayload,
      config.secret,
      config.algorithm || 'HS256'
    );
  }

  /**
   * Verify and decode JWT token
   */
  verify(token: string, options?: Partial<JwtOptions>): JwtPayload {
    const config = { ...this.config, ...options };
    return this.parseToken(token, config.secret, config.algorithm || 'HS256');
  }

  /**
   * Decode token without verification (for inspection)
   */
  decode(token: string): JwtPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isExpired(token: string): boolean {
    const payload = this.decode(token);
    if (!payload || !payload.exp) return true;
    return payload.exp < Math.floor(Date.now() / 1000);
  }

  /**
   * Get token expiration date
   */
  getExpiration(token: string): Date | null {
    const payload = this.decode(token);
    if (!payload || !payload.exp) return null;
    return new Date(payload.exp * 1000);
  }

  /**
   * Refresh token with new expiration
   */
  refresh(token: string, newExpiry?: string | number): string {
    const payload = this.verify(token);
    const { iat, exp, ...refreshPayload } = payload;

    const options: Partial<JwtOptions> = {};
    if (newExpiry !== undefined) {
      options.expiresIn = newExpiry;
    } else if (this.config.expiresIn !== undefined) {
      options.expiresIn = this.config.expiresIn;
    }

    return this.sign(refreshPayload, options);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<JwtOptions>): void {
    this.config = { ...this.config, ...newConfig };
    this.validateConfig();
  }

  /**
   * Validate JWT configuration
   */
  private validateConfig(): void {
    if (!this.config.secret || this.config.secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }

    const validAlgorithms = ['HS256', 'HS384', 'HS512'];
    if (
      this.config.algorithm &&
      !validAlgorithms.includes(this.config.algorithm)
    ) {
      throw new Error(
        `Invalid JWT algorithm. Supported: ${validAlgorithms.join(', ')}`
      );
    }
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiry(expiry: string | number): number {
    if (typeof expiry === 'number') return expiry;

    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid expiry format: ${expiry}`);

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 24 * 60 * 60,
    };

    return value * (multipliers[unit as keyof typeof multipliers] || 1);
  }

  /**
   * Create JWT token with HMAC signature
   */
  private createToken(
    payload: JwtPayload,
    secret: string,
    algorithm: string
  ): string {
    const header = {
      typ: 'JWT',
      alg: algorithm,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
      'base64url'
    );
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url'
    );

    const signature = crypto
      .createHmac(this.getHashAlgorithm(algorithm), secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Parse and verify JWT token
   */
  private parseToken(
    token: string,
    secret: string,
    algorithm: string
  ): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const [headerPart, payloadPart, signaturePart] = parts;

    // Verify signature
    const expectedSignature = crypto
      .createHmac(this.getHashAlgorithm(algorithm), secret)
      .update(`${headerPart}.${payloadPart}`)
      .digest('base64url');

    if (signaturePart !== expectedSignature) {
      throw new Error('Invalid JWT signature');
    }

    // Parse and validate payload
    const payload: JwtPayload = JSON.parse(
      Buffer.from(payloadPart, 'base64url').toString()
    );

    const now = Math.floor(Date.now() / 1000);

    // Check expiry
    if (payload.exp && payload.exp < now) {
      throw new Error('JWT token expired');
    }

    // Check not before
    if (payload.nbf && payload.nbf > now) {
      throw new Error('JWT token not yet valid');
    }

    // Check issuer
    if (this.config.issuer && payload.iss !== this.config.issuer) {
      throw new Error('Invalid JWT issuer');
    }

    // Check audience
    if (this.config.audience && payload.aud !== this.config.audience) {
      throw new Error('Invalid JWT audience');
    }

    return payload;
  }

  /**
   * Get hash algorithm for HMAC
   */
  private getHashAlgorithm(jwtAlgorithm: string): string {
    const algorithmMap: Record<string, string> = {
      HS256: 'sha256',
      HS384: 'sha384',
      HS512: 'sha512',
    };

    return algorithmMap[jwtAlgorithm] || 'sha256';
  }
}

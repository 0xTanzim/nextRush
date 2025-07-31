/**
 * 🔍 Auth Authenticator - NextRush Framework
 *
 * Core authentication logic for JWT and session strategies.
 */

import { NextRushRequest } from '../../types/express';
import { AuthResult, AuthStrategy, JwtPayload, User } from './interfaces';
import { JwtManager } from './jwt-manager';
import { SessionManager } from './session-manager';

/**
 * Core authenticator for handling different auth strategies
 */
export class AuthAuthenticator {
  private jwtManager?: JwtManager;
  private sessionManager?: SessionManager;

  constructor(jwtManager?: JwtManager, sessionManager?: SessionManager) {
    if (jwtManager) this.jwtManager = jwtManager;
    if (sessionManager) this.sessionManager = sessionManager;
  }

  /**
   * Authenticate request using specified strategy
   */
  async authenticate(
    req: NextRushRequest,
    strategy: AuthStrategy
  ): Promise<AuthResult> {
    switch (strategy) {
      case 'jwt':
        return this.authenticateJwt(req);
      case 'session':
        return this.authenticateSession(req);
      default:
        return { user: null, error: 'Unknown authentication strategy' };
    }
  }

  /**
   * Authenticate using JWT token
   */
  async authenticateJwt(req: NextRushRequest): Promise<AuthResult> {
    if (!this.jwtManager) {
      return { user: null, error: 'JWT not configured' };
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'Missing or invalid Authorization header' };
    }

    const token = authHeader.slice(7);
    try {
      const payload = this.jwtManager.verify(token);
      const user = this.payloadToUser(payload);
      return { user };
    } catch (error) {
      return {
        user: null,
        error: error instanceof Error ? error.message : 'Invalid token',
      };
    }
  }

  /**
   * Authenticate using session
   */
  async authenticateSession(req: NextRushRequest): Promise<AuthResult> {
    if (!this.sessionManager) {
      return { user: null, error: 'Sessions not configured' };
    }

    const cookieName = this.sessionManager.getCookieOptions().name;
    const cookies = this.sessionManager.parseCookies(req.headers.cookie || '');
    const sessionId = cookies[cookieName];

    if (!sessionId) {
      return { user: null, error: 'No session cookie found' };
    }

    try {
      const session = await this.sessionManager.get(sessionId);
      if (!session) {
        return { user: null, error: 'Invalid or expired session' };
      }

      const user = session.data.user as User;
      if (!user) {
        return { user: null, error: 'No user data in session' };
      }

      return { user };
    } catch (error) {
      return {
        user: null,
        error: error instanceof Error ? error.message : 'Session error',
      };
    }
  }

  /**
   * Try multiple authentication strategies
   */
  async authenticateMultiple(
    req: NextRushRequest,
    strategies: AuthStrategy[]
  ): Promise<AuthResult> {
    for (const strategy of strategies) {
      const result = await this.authenticate(req, strategy);
      if (result.user) {
        return result;
      }
    }

    return { user: null, error: 'Authentication failed for all strategies' };
  }

  /**
   * Extract user info from request
   */
  async extractUser(req: NextRushRequest): Promise<User | null> {
    // Try JWT first
    if (this.jwtManager) {
      const jwtResult = await this.authenticateJwt(req);
      if (jwtResult.user) return jwtResult.user;
    }

    // Try session next
    if (this.sessionManager) {
      const sessionResult = await this.authenticateSession(req);
      if (sessionResult.user) return sessionResult.user;
    }

    return null;
  }

  /**
   * Check if request is authenticated
   */
  async isAuthenticated(
    req: NextRushRequest,
    strategy?: AuthStrategy
  ): Promise<boolean> {
    if (strategy) {
      const result = await this.authenticate(req, strategy);
      return result.user !== null;
    }

    // Try any available strategy
    const user = await this.extractUser(req);
    return user !== null;
  }

  /**
   * Get authentication info from request
   */
  async getAuthInfo(req: NextRushRequest): Promise<{
    authenticated: boolean;
    user: User | null;
    strategy?: AuthStrategy;
    error?: string;
  }> {
    // Try JWT
    if (this.jwtManager) {
      const jwtResult = await this.authenticateJwt(req);
      if (jwtResult.user) {
        return {
          authenticated: true,
          user: jwtResult.user,
          strategy: 'jwt',
        };
      }
    }

    // Try session
    if (this.sessionManager) {
      const sessionResult = await this.authenticateSession(req);
      if (sessionResult.user) {
        return {
          authenticated: true,
          user: sessionResult.user,
          strategy: 'session',
        };
      }
    }

    return {
      authenticated: false,
      user: null,
      error: 'No valid authentication found',
    };
  }

  /**
   * Update managers
   */
  updateJwtManager(jwtManager: JwtManager): void {
    this.jwtManager = jwtManager;
  }

  updateSessionManager(sessionManager: SessionManager): void {
    this.sessionManager = sessionManager;
  }

  /**
   * Convert JWT payload to User object
   */
  private payloadToUser(payload: JwtPayload): User {
    const user: User = {
      id: payload.sub || 'unknown',
      roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
      permissions: Array.isArray(payload.permissions)
        ? (payload.permissions as string[])
        : [],
      metadata: (payload.metadata as Record<string, unknown>) || {},
    };

    if (payload.username && typeof payload.username === 'string') {
      user.username = payload.username;
    }

    if (payload.email && typeof payload.email === 'string') {
      user.email = payload.email;
    }

    return user;
  }
}

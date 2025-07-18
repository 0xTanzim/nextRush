/**
 * 🔐 Auth Plugin - NextRush Framework
 *
 * Built-in authentication system with JWT, session tokens, and RBAC support.
 * Provides secure route guards, claims, and permissions management.
 */

import * as crypto from 'crypto';
import { Application } from '../../core/app/application';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

/**
 * JWT configuration options
 */
export interface JwtOptions {
  secret: string;
  algorithm?: 'HS256' | 'HS384' | 'HS512';
  expiresIn?: string | number; // e.g., '1h', '7d', 3600
  issuer?: string;
  audience?: string;
  notBefore?: string | number;
}

/**
 * Session configuration options
 */
export interface SessionOptions {
  secret: string;
  name?: string; // Cookie name
  maxAge?: number; // Session max age in milliseconds
  secure?: boolean; // Require HTTPS
  httpOnly?: boolean; // HTTP only cookies
  sameSite?: 'strict' | 'lax' | 'none';
  rolling?: boolean; // Reset expiry on activity
  store?: SessionStore; // Custom session store
}

/**
 * User interface for authentication
 */
export interface User {
  id: string | number;
  username?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  metadata?: Record<string, any>;
}

/**
 * JWT payload interface
 */
export interface JwtPayload {
  sub: string | number; // Subject (user ID)
  iat: number; // Issued at
  exp: number; // Expires at
  iss?: string; // Issuer
  aud?: string; // Audience
  nbf?: number; // Not before
  [key: string]: any; // Additional claims
}

/**
 * Session data interface
 */
export interface SessionData {
  id: string;
  userId: string | number;
  data: Record<string, any>;
  createdAt: number;
  lastAccess: number;
  expiresAt: number;
}

/**
 * Session store interface
 */
export interface SessionStore {
  get(sessionId: string): Promise<SessionData | undefined>;
  set(sessionId: string, data: SessionData): Promise<void>;
  destroy(sessionId: string): Promise<void>;
  cleanup(): Promise<void>;
}

/**
 * Memory session store
 */
export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, SessionData>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.startCleanup();
  }

  async get(sessionId: string): Promise<SessionData | undefined> {
    const session = this.sessions.get(sessionId);
    if (session && session.expiresAt > Date.now()) {
      return session;
    }
    if (session) {
      this.sessions.delete(sessionId);
    }
    return undefined;
  }

  async set(sessionId: string, data: SessionData): Promise<void> {
    this.sessions.set(sessionId, data);
  }

  async destroy(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(id);
      }
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  destroyStore(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }
}

/**
 * RBAC permissions interface
 */
export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

/**
 * Role interface
 */
export interface Role {
  name: string;
  permissions: Permission[];
  inherits?: string[]; // Parent roles
}

/**
 * 🔐 Auth Plugin
 */
export class AuthPlugin extends BasePlugin {
  name = 'Auth';
  private jwtConfig?: JwtOptions;
  private sessionConfig?: SessionOptions;
  private sessionStore: SessionStore;
  private roles = new Map<string, Role>();

  constructor(registry: PluginRegistry) {
    super(registry);
    this.sessionStore = new MemorySessionStore();
  }

  /**
   * Install auth capabilities
   */
  install(app: Application): void {
    // Configure JWT
    (app as any).useJwt = (options: JwtOptions) => {
      this.jwtConfig = options;
      return app;
    };

    // Configure sessions
    (app as any).useSession = (options: SessionOptions) => {
      this.sessionConfig = options;
      if (options.store) {
        this.sessionStore = options.store;
      }
      return app;
    };

    // JWT methods
    (app as any).signJwt = (payload: any, options?: Partial<JwtOptions>) => {
      return this.signJwt(payload, options);
    };

    (app as any).verifyJwt = (token: string, options?: Partial<JwtOptions>) => {
      return this.verifyJwt(token, options);
    };

    // Authentication middleware
    (app as any).requireAuth = (strategy: 'jwt' | 'session' = 'jwt') => {
      return async (
        req: NextRushRequest,
        res: NextRushResponse,
        next: () => void
      ) => {
        try {
          let user: User | null = null;

          if (strategy === 'jwt') {
            user = await this.authenticateJwt(req);
          } else if (strategy === 'session') {
            user = await this.authenticateSession(req);
          }

          if (!user) {
            return res.status(401).json({
              error: 'Unauthorized',
              message: 'Authentication required',
            });
          }

          (req as any).user = user;
          next();
        } catch (error) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid authentication',
          });
        }
      };
    };

    // Role-based access control
    (app as any).requireRole = (...roles: string[]) => {
      return (
        req: NextRushRequest,
        res: NextRushResponse,
        next: () => void
      ) => {
        const user = (req as any).user as User;

        if (!user) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required',
          });
        }

        if (!user.roles || !roles.some((role) => user.roles!.includes(role))) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Insufficient permissions',
          });
        }

        next();
      };
    };

    // Permission-based access control
    (app as any).requirePermission = (resource: string, action: string) => {
      return (
        req: NextRushRequest,
        res: NextRushResponse,
        next: () => void
      ) => {
        const user = (req as any).user as User;

        if (!user) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required',
          });
        }

        const hasPermission = this.checkPermission(user, resource, action);

        if (!hasPermission) {
          return res.status(403).json({
            error: 'Forbidden',
            message: `Permission denied for ${action} on ${resource}`,
          });
        }

        next();
      };
    };

    // Session management
    (app as any).createSession = async (
      userId: string | number,
      data: Record<string, any> = {}
    ) => {
      return this.createSession(userId, data);
    };

    (app as any).destroySession = async (sessionId: string) => {
      return this.sessionStore.destroy(sessionId);
    };

    // Role management
    (app as any).defineRole = (role: Role) => {
      this.roles.set(role.name, role);
      return app;
    };

    (app as any).getRole = (name: string) => {
      return this.roles.get(name);
    };

    this.emit('auth:installed');
  }

  /**
   * Start the auth plugin
   */
  start(): void {
    this.emit('auth:started');
  }

  /**
   * Stop the auth plugin
   */
  stop(): void {
    if (this.sessionStore instanceof MemorySessionStore) {
      (this.sessionStore as MemorySessionStore).destroyStore();
    }
    this.emit('auth:stopped');
  }

  /**
   * Sign JWT token
   */
  private signJwt(payload: any, options?: Partial<JwtOptions>): string {
    if (!this.jwtConfig) {
      throw new Error('JWT not configured. Call app.useJwt() first.');
    }

    const config = { ...this.jwtConfig, ...options };
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

    return this.createJwt(
      jwtPayload,
      config.secret,
      config.algorithm || 'HS256'
    );
  }

  /**
   * Verify JWT token
   */
  private verifyJwt(token: string, options?: Partial<JwtOptions>): JwtPayload {
    if (!this.jwtConfig) {
      throw new Error('JWT not configured. Call app.useJwt() first.');
    }

    const config = { ...this.jwtConfig, ...options };
    return this.parseJwt(token, config.secret, config.algorithm || 'HS256');
  }

  /**
   * Authenticate using JWT
   */
  private async authenticateJwt(req: NextRushRequest): Promise<User | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.slice(7);
    try {
      const payload = this.verifyJwt(token);

      // Convert JWT payload to User object
      const user: User = {
        id: payload.sub,
        roles: payload.roles || [],
        permissions: payload.permissions || [],
        metadata: payload.metadata || {},
      };

      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Authenticate using session
   */
  private async authenticateSession(
    req: NextRushRequest
  ): Promise<User | null> {
    if (!this.sessionConfig) {
      throw new Error('Sessions not configured. Call app.useSession() first.');
    }

    const cookieName = this.sessionConfig.name || 'session';
    const cookies = this.parseCookies(req.headers.cookie || '');
    const sessionId = cookies[cookieName];

    if (!sessionId) {
      return null;
    }

    const session = await this.sessionStore.get(sessionId);
    if (!session) {
      return null;
    }

    // Update last access time
    session.lastAccess = Date.now();
    await this.sessionStore.set(sessionId, session);

    return session.data.user || null;
  }

  /**
   * Create new session
   */
  private async createSession(
    userId: string | number,
    data: Record<string, any> = {}
  ): Promise<string> {
    if (!this.sessionConfig) {
      throw new Error('Sessions not configured. Call app.useSession() first.');
    }

    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const maxAge = this.sessionConfig.maxAge || 24 * 60 * 60 * 1000; // 24 hours

    const sessionData: SessionData = {
      id: sessionId,
      userId,
      data: { ...data, user: { id: userId, ...data.user } },
      createdAt: now,
      lastAccess: now,
      expiresAt: now + maxAge,
    };

    await this.sessionStore.set(sessionId, sessionData);
    return sessionId;
  }

  /**
   * Check user permission
   */
  private checkPermission(
    user: User,
    resource: string,
    action: string
  ): boolean {
    // Direct permission check
    if (user.permissions) {
      const hasDirectPermission = user.permissions.some((perm) => {
        const [permResource, permAction] = perm.split(':');
        return (
          (permResource === resource || permResource === '*') &&
          (permAction === action || permAction === '*')
        );
      });
      if (hasDirectPermission) return true;
    }

    // Role-based permission check
    if (user.roles) {
      for (const roleName of user.roles) {
        const role = this.roles.get(roleName);
        if (role && this.roleHasPermission(role, resource, action)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if role has permission
   */
  private roleHasPermission(
    role: Role,
    resource: string,
    action: string
  ): boolean {
    // Check direct permissions
    const hasPermission = role.permissions.some(
      (perm) =>
        (perm.resource === resource || perm.resource === '*') &&
        (perm.action === action || perm.action === '*')
    );

    if (hasPermission) return true;

    // Check inherited roles
    if (role.inherits) {
      for (const parentRoleName of role.inherits) {
        const parentRole = this.roles.get(parentRoleName);
        if (
          parentRole &&
          this.roleHasPermission(parentRole, resource, action)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiry(expiry: string | number): number {
    if (typeof expiry === 'number') return expiry;

    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error('Invalid expiry format');

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        throw new Error('Invalid expiry unit');
    }
  }

  /**
   * Create JWT token (simplified implementation)
   */
  private createJwt(
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
      .createHmac(algorithm.toLowerCase().replace('hs', 'sha'), secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Parse and verify JWT token
   */
  private parseJwt(
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
      .createHmac(algorithm.toLowerCase().replace('hs', 'sha'), secret)
      .update(`${headerPart}.${payloadPart}`)
      .digest('base64url');

    if (signaturePart !== expectedSignature) {
      throw new Error('Invalid JWT signature');
    }

    // Parse payload
    const payload = JSON.parse(
      Buffer.from(payloadPart, 'base64url').toString()
    );

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('JWT expired');
    }

    // Check not before
    if (payload.nbf && payload.nbf > Math.floor(Date.now() / 1000)) {
      throw new Error('JWT not yet valid');
    }

    return payload;
  }

  /**
   * Parse cookies from header
   */
  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};

    cookieHeader.split(';').forEach((cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });

    return cookies;
  }
}

/**
 * Predefined roles for common use cases
 */
export const CommonRoles = {
  admin: (): Role => ({
    name: 'admin',
    permissions: [{ resource: '*', action: '*' }],
  }),

  user: (): Role => ({
    name: 'user',
    permissions: [
      { resource: 'profile', action: 'read' },
      { resource: 'profile', action: 'update' },
    ],
  }),

  moderator: (): Role => ({
    name: 'moderator',
    permissions: [
      { resource: 'content', action: 'read' },
      { resource: 'content', action: 'update' },
      { resource: 'content', action: 'delete' },
      { resource: 'users', action: 'read' },
    ],
    inherits: ['user'],
  }),
};

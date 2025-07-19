/**
 * 🔐 Auth Plugin - NextRush Framework
 *
 * Modular authentication system with JWT, sessions, and RBAC support.
 * Provides secure route guards, claims, and permissions management.
 */

import { Application } from '../../core/app/application';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';
import { AuthAuthenticator } from './authenticator';
import {
  AuthConfig,
  AuthStrategy,
  JwtOptions,
  MiddlewareFunction,
  Role,
  SessionOptions,
  User,
} from './interfaces';
import { JwtManager } from './jwt-manager';
import { CommonRoles, RbacManager } from './rbac-manager';
import { MemorySessionStore, SessionManager } from './session-manager';

/**
 * 🔐 Optimized Auth Plugin
 */
export class AuthPlugin extends BasePlugin {
  name = 'Auth';

  // Core managers
  private jwtManager?: JwtManager;
  private sessionManager?: SessionManager;
  private rbacManager: RbacManager;
  private authenticator: AuthAuthenticator;

  // Configuration
  private config: Partial<AuthConfig> = {};

  constructor(registry: PluginRegistry) {
    super(registry);
    this.rbacManager = new RbacManager();
    this.authenticator = new AuthAuthenticator();
  }

  /**
   * Install auth capabilities on the application
   */
  install(app: Application): void {
    this.installConfiguration(app);
    this.installJwtMethods(app);
    this.installSessionMethods(app);
    this.installAuthMiddleware(app);
    this.installRbacMethods(app);
    this.installUtilityMethods(app);

    this.emit('auth:installed');
  }

  /**
   * Start the auth plugin
   */
  start(): void {
    // Setup default roles
    this.setupDefaultRoles();
    this.emit('auth:started');
  }

  /**
   * Stop the auth plugin
   */
  stop(): void {
    // Cleanup session store if memory-based
    if (this.sessionManager?.['store'] instanceof MemorySessionStore) {
      (this.sessionManager['store'] as MemorySessionStore).destroyStore();
    }
    this.emit('auth:stopped');
  }

  /**
   * Install configuration methods
   */
  private installConfiguration(app: Application): void {
    // JWT Configuration
    (app as any).useJwt = (options: JwtOptions) => {
      this.jwtManager = new JwtManager(options);
      this.authenticator.updateJwtManager(this.jwtManager);
      this.config.jwt = options;
      return app;
    };

    // Session Configuration
    (app as any).useSession = (options: SessionOptions) => {
      this.sessionManager = new SessionManager(options);
      this.authenticator.updateSessionManager(this.sessionManager);
      this.config.session = options;
      return app;
    };

    // Full auth configuration
    (app as any).configureAuth = (config: AuthConfig) => {
      this.config = { ...config };

      if (config.jwt) {
        (app as any).useJwt(config.jwt);
      }

      if (config.session) {
        (app as any).useSession(config.session);
      }

      return app;
    };
  }

  /**
   * Install JWT methods
   */
  private installJwtMethods(app: Application): void {
    // Sign JWT token
    (app as any).signJwt = (
      payload: Record<string, unknown>,
      options?: Partial<JwtOptions>
    ): string => {
      if (!this.jwtManager) {
        throw new Error('JWT not configured. Call app.useJwt() first.');
      }
      return this.jwtManager.sign(payload, options);
    };

    // Verify JWT token
    (app as any).verifyJwt = (token: string, options?: Partial<JwtOptions>) => {
      if (!this.jwtManager) {
        throw new Error('JWT not configured. Call app.verifyJwt() first.');
      }
      return this.jwtManager.verify(token, options);
    };

    // Decode JWT token (without verification)
    (app as any).decodeJwt = (token: string) => {
      if (!this.jwtManager) {
        throw new Error('JWT not configured. Call app.useJwt() first.');
      }
      return this.jwtManager.decode(token);
    };

    // Refresh JWT token
    (app as any).refreshJwt = (token: string, newExpiry?: string | number) => {
      if (!this.jwtManager) {
        throw new Error('JWT not configured. Call app.useJwt() first.');
      }
      return this.jwtManager.refresh(token, newExpiry);
    };
  }

  /**
   * Install session methods
   */
  private installSessionMethods(app: Application): void {
    // Create session
    (app as any).createSession = async (
      userId: string | number,
      data: Record<string, any> = {}
    ): Promise<string> => {
      if (!this.sessionManager) {
        throw new Error(
          'Sessions not configured. Call app.useSession() first.'
        );
      }
      return this.sessionManager.create(userId, data);
    };

    // Get session
    (app as any).getSession = async (sessionId: string) => {
      if (!this.sessionManager) {
        throw new Error(
          'Sessions not configured. Call app.useSession() first.'
        );
      }
      return this.sessionManager.get(sessionId);
    };

    // Update session
    (app as any).updateSession = async (
      sessionId: string,
      data: Record<string, any>
    ): Promise<boolean> => {
      if (!this.sessionManager) {
        throw new Error(
          'Sessions not configured. Call app.useSession() first.'
        );
      }
      return this.sessionManager.update(sessionId, data);
    };

    // Destroy session
    (app as any).destroySession = async (sessionId: string): Promise<void> => {
      if (!this.sessionManager) {
        throw new Error(
          'Sessions not configured. Call app.useSession() first.'
        );
      }
      return this.sessionManager.destroy(sessionId);
    };

    // Session utilities
    (app as any).touchSession = async (sessionId: string): Promise<boolean> => {
      if (!this.sessionManager) {
        throw new Error(
          'Sessions not configured. Call app.useSession() first.'
        );
      }
      return this.sessionManager.touch(sessionId);
    };

    (app as any).getSessionStats = async () => {
      if (!this.sessionManager) {
        throw new Error(
          'Sessions not configured. Call app.useSession() first.'
        );
      }
      return this.sessionManager.getStats();
    };
  }

  /**
   * Install authentication middleware
   */
  private installAuthMiddleware(app: Application): void {
    // Main authentication middleware
    (app as any).requireAuth = (
      strategy: AuthStrategy = 'jwt'
    ): MiddlewareFunction => {
      return async (
        req: NextRushRequest,
        res: NextRushResponse,
        next: () => void
      ) => {
        try {
          const result = await this.authenticator.authenticate(req, strategy);

          if (!result.user) {
            return res.status(401).json({
              error: 'Unauthorized',
              message: result.error || 'Authentication required',
            });
          }

          (req as any).user = result.user;
          (req as any).authStrategy = strategy;
          next();
        } catch (error) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication failed',
          });
        }
      };
    };

    // Optional authentication (won't fail if no auth)
    (app as any).optionalAuth = (
      strategy: AuthStrategy = 'jwt'
    ): MiddlewareFunction => {
      return async (
        req: NextRushRequest,
        res: NextRushResponse,
        next: () => void
      ) => {
        try {
          const result = await this.authenticator.authenticate(req, strategy);

          if (result.user) {
            (req as any).user = result.user;
            (req as any).authStrategy = strategy;
          }

          next();
        } catch (error) {
          // Continue without authentication
          next();
        }
      };
    };

    // Multi-strategy authentication
    (app as any).requireAnyAuth = (
      ...strategies: AuthStrategy[]
    ): MiddlewareFunction => {
      return async (
        req: NextRushRequest,
        res: NextRushResponse,
        next: () => void
      ) => {
        try {
          const result = await this.authenticator.authenticateMultiple(
            req,
            strategies
          );

          if (!result.user) {
            return res.status(401).json({
              error: 'Unauthorized',
              message: result.error || 'Authentication required',
            });
          }

          (req as any).user = result.user;
          next();
        } catch (error) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication failed',
          });
        }
      };
    };
  }

  /**
   * Install RBAC methods
   */
  private installRbacMethods(app: Application): void {
    // Role management
    (app as any).defineRole = (role: Role) => {
      this.rbacManager.defineRole(role);
      return app;
    };

    (app as any).getRole = (name: string) => {
      return this.rbacManager.getRole(name);
    };

    (app as any).getAllRoles = () => {
      return this.rbacManager.getAllRoles();
    };

    // Role-based middleware
    (app as any).requireRole = (...roles: string[]): MiddlewareFunction => {
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

        if (!this.rbacManager.hasRole(user, ...roles)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: `Requires one of roles: ${roles.join(', ')}`,
          });
        }

        next();
      };
    };

    // Permission-based middleware
    (app as any).requirePermission = (
      resource: string,
      action: string
    ): MiddlewareFunction => {
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

        if (!this.rbacManager.hasPermission(user, resource, action)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: `Permission denied for ${action} on ${resource}`,
          });
        }

        next();
      };
    };

    // Check permission utility
    (app as any).hasPermission = (
      user: User,
      resource: string,
      action: string
    ): boolean => {
      return this.rbacManager.hasPermission(user, resource, action);
    };

    // Get user permissions
    (app as any).getUserPermissions = (user: User) => {
      return this.rbacManager.getUserPermissions(user);
    };
  }

  /**
   * Install utility methods
   */
  private installUtilityMethods(app: Application): void {
    // Get current user from request
    (app as any).getCurrentUser = (req: NextRushRequest): User | null => {
      return (req as any).user || null;
    };

    // Check if request is authenticated
    (app as any).isAuthenticated = async (
      req: NextRushRequest,
      strategy?: AuthStrategy
    ): Promise<boolean> => {
      return this.authenticator.isAuthenticated(req, strategy);
    };

    // Get auth info
    (app as any).getAuthInfo = async (req: NextRushRequest) => {
      return this.authenticator.getAuthInfo(req);
    };

    // Get auth configuration
    (app as any).getAuthConfig = () => {
      return { ...this.config };
    };

    // Clear auth caches
    (app as any).clearAuthCache = () => {
      this.rbacManager.clearPermissionCache();
      return app;
    };
  }

  /**
   * Setup default roles
   */
  private setupDefaultRoles(): void {
    // Only setup if no roles exist yet
    if (this.rbacManager.getAllRoles().length === 0) {
      this.rbacManager.defineRole(CommonRoles.admin());
      this.rbacManager.defineRole(CommonRoles.user());
      this.rbacManager.defineRole(CommonRoles.moderator());
      this.rbacManager.defineRole(CommonRoles.editor());
      this.rbacManager.defineRole(CommonRoles.viewer());
    }
  }
}

// Export common roles and interfaces
export * from './interfaces';
export { CommonRoles } from './rbac-manager';
export { MemorySessionStore } from './session-manager';

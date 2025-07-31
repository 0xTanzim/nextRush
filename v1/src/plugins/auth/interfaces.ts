/**
 * 🔐 Auth Plugin Interfaces - NextRush Framework
 *
 * Type definitions for authentication, authorization, and session management.
 */

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
  metadata?: Record<string, unknown>;
}

/**
 * JWT payload interface for type safety
 */
export interface JwtPayload {
  sub?: string | number; // Subject (user ID)
  iss?: string; // Issuer
  aud?: string; // Audience
  exp?: number; // Expiration time
  nbf?: number; // Not before
  iat?: number; // Issued at
  jti?: string; // JWT ID
  roles?: string[]; // User roles
  permissions?: string[]; // User permissions
  metadata?: Record<string, unknown>; // Additional user data
  [key: string]: unknown; // Allow additional claims
}

/**
 * Session data interface
 */
export interface SessionData {
  id: string;
  userId: string | number;
  data: Record<string, unknown>;
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
 * Authentication result
 */
export interface AuthResult {
  user: User | null;
  error?: string;
}

/**
 * Authentication strategy type
 */
export type AuthStrategy = 'jwt' | 'session';

/**
 * Middleware function type
 */
export type MiddlewareFunction = (
  req: any,
  res: any,
  next: () => void
) => void | Promise<void>;

/**
 * Auth configuration options
 */
export interface AuthConfig {
  jwt?: JwtOptions;
  session?: SessionOptions;
  defaultStrategy?: AuthStrategy;
  rateLimiting?: {
    enabled: boolean;
    maxAttempts: number;
    windowMs: number;
  };
}

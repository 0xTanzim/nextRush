/**
 * 💾 Session Manager - NextRush Framework
 *
 * High-performance session handling with multiple storage backends.
 */

import * as crypto from 'crypto';
import { SessionData, SessionOptions, SessionStore } from './interfaces';

/**
 * Memory session store implementation
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
    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Get session count
   */
  size(): number {
    return this.sessions.size;
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    const now = Date.now();
    return Array.from(this.sessions.entries())
      .filter(([, session]) => session.expiresAt > now)
      .map(([id]) => id);
  }

  /**
   * Destroy the store and cleanup
   */
  destroyStore(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }
}

/**
 * Session Manager for session operations
 */
export class SessionManager {
  private config: SessionOptions;
  private store: SessionStore;

  constructor(config: SessionOptions) {
    this.config = { ...config };
    this.store = config.store || new MemorySessionStore();
    this.validateConfig();
  }

  /**
   * Create a new session
   */
  async create(
    userId: string | number,
    data: Record<string, any> = {}
  ): Promise<string> {
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const maxAge = this.config.maxAge || 24 * 60 * 60 * 1000; // 24 hours

    const sessionData: SessionData = {
      id: sessionId,
      userId,
      data: { ...data, user: { id: userId, ...data.user } },
      createdAt: now,
      lastAccess: now,
      expiresAt: now + maxAge,
    };

    await this.store.set(sessionId, sessionData);
    return sessionId;
  }

  /**
   * Get session data
   */
  async get(sessionId: string): Promise<SessionData | undefined> {
    const session = await this.store.get(sessionId);
    if (session && this.config.rolling) {
      // Update last access time for rolling sessions
      session.lastAccess = Date.now();
      session.expiresAt =
        session.lastAccess + (this.config.maxAge || 24 * 60 * 60 * 1000);
      await this.store.set(sessionId, session);
    }
    return session;
  }

  /**
   * Update session data
   */
  async update(
    sessionId: string,
    data: Partial<Record<string, any>>
  ): Promise<boolean> {
    const session = await this.store.get(sessionId);
    if (!session) return false;

    session.data = { ...session.data, ...data };
    session.lastAccess = Date.now();

    if (this.config.rolling) {
      session.expiresAt =
        session.lastAccess + (this.config.maxAge || 24 * 60 * 60 * 1000);
    }

    await this.store.set(sessionId, session);
    return true;
  }

  /**
   * Destroy a session
   */
  async destroy(sessionId: string): Promise<void> {
    await this.store.destroy(sessionId);
  }

  /**
   * Touch session (update last access time)
   */
  async touch(sessionId: string): Promise<boolean> {
    const session = await this.store.get(sessionId);
    if (!session) return false;

    session.lastAccess = Date.now();
    if (this.config.rolling) {
      session.expiresAt =
        session.lastAccess + (this.config.maxAge || 24 * 60 * 60 * 1000);
    }

    await this.store.set(sessionId, session);
    return true;
  }

  /**
   * Check if session exists and is valid
   */
  async exists(sessionId: string): Promise<boolean> {
    const session = await this.store.get(sessionId);
    return session !== undefined;
  }

  /**
   * Get session user data
   */
  async getUser(sessionId: string): Promise<any> {
    const session = await this.store.get(sessionId);
    return session?.data.user || null;
  }

  /**
   * Destroy all sessions for a user
   */
  async destroyAllForUser(userId: string | number): Promise<void> {
    // Note: This is not efficient for all stores, might need optimization per store type
    if (this.store instanceof MemorySessionStore) {
      const activeSessions = this.store.getActiveSessions();
      for (const sessionId of activeSessions) {
        const session = await this.store.get(sessionId);
        if (session && session.userId === userId) {
          await this.store.destroy(sessionId);
        }
      }
    }
  }

  /**
   * Generate cookie options
   */
  getCookieOptions(): {
    name: string;
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  } {
    const options: {
      name: string;
      maxAge?: number;
      secure?: boolean;
      httpOnly?: boolean;
      sameSite?: 'strict' | 'lax' | 'none';
    } = {
      name: this.config.name || 'session',
      httpOnly: this.config.httpOnly !== false, // Default to true
    };

    if (this.config.maxAge !== undefined) options.maxAge = this.config.maxAge;
    if (this.config.secure !== undefined) options.secure = this.config.secure;
    if (this.config.sameSite !== undefined)
      options.sameSite = this.config.sameSite;

    return options;
  }

  /**
   * Parse cookies from request header
   */
  parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};

    if (!cookieHeader) return cookies;

    cookieHeader.split(';').forEach((cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });

    return cookies;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SessionOptions>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.store) {
      this.store = newConfig.store;
    }
    this.validateConfig();
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
  }> {
    if (this.store instanceof MemorySessionStore) {
      const activeSessions = this.store.getActiveSessions();
      return {
        totalSessions: this.store.size(),
        activeSessions: activeSessions.length,
      };
    }

    return {
      totalSessions: 0,
      activeSessions: 0,
    };
  }

  /**
   * Cleanup expired sessions
   */
  async cleanup(): Promise<void> {
    await this.store.cleanup();
  }

  /**
   * Validate session configuration
   */
  private validateConfig(): void {
    if (!this.config.secret || this.config.secret.length < 32) {
      throw new Error('Session secret must be at least 32 characters long');
    }

    if (this.config.maxAge && this.config.maxAge < 1000) {
      throw new Error('Session maxAge must be at least 1000ms (1 second)');
    }

    const validSameSite = ['strict', 'lax', 'none'];
    if (this.config.sameSite && !validSameSite.includes(this.config.sameSite)) {
      throw new Error(
        `Invalid sameSite value. Supported: ${validSameSite.join(', ')}`
      );
    }
  }
}

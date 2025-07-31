/**
 * 🛡️ RBAC Manager - NextRush Framework
 *
 * Role-Based Access Control with hierarchical permissions and inheritance.
 */

import { Permission, Role, User } from './interfaces';

/**
 * RBAC Manager for role and permission handling
 */
export class RbacManager {
  private roles = new Map<string, Role>();
  private permissionCache = new Map<string, boolean>();

  /**
   * Define a new role
   */
  defineRole(role: Role): void {
    this.validateRole(role);
    this.roles.set(role.name, { ...role });
    this.clearPermissionCache();
  }

  /**
   * Get a role by name
   */
  getRole(name: string): Role | undefined {
    return this.roles.get(name);
  }

  /**
   * Get all roles
   */
  getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * Delete a role
   */
  deleteRole(name: string): boolean {
    const deleted = this.roles.delete(name);
    if (deleted) {
      this.clearPermissionCache();
    }
    return deleted;
  }

  /**
   * Check if user has permission
   */
  hasPermission(user: User, resource: string, action: string): boolean {
    const cacheKey = this.getPermissionCacheKey(user, resource, action);

    // Check cache first
    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey)!;
    }

    const hasPermission = this.checkPermissionInternal(user, resource, action);

    // Cache the result
    this.permissionCache.set(cacheKey, hasPermission);

    return hasPermission;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasRole(user: User, ...roles: string[]): boolean {
    if (!user.roles || user.roles.length === 0) return false;
    return roles.some((role) => user.roles!.includes(role));
  }

  /**
   * Get all permissions for a user (direct + role-based)
   */
  getUserPermissions(user: User): Permission[] {
    const permissions: Permission[] = [];

    // Add direct permissions
    if (user.permissions) {
      user.permissions.forEach((perm) => {
        const [resource, action] = perm.split(':');
        if (resource && action) {
          permissions.push({ resource, action });
        }
      });
    }

    // Add role-based permissions
    if (user.roles) {
      for (const roleName of user.roles) {
        const rolePermissions = this.getRolePermissions(roleName);
        permissions.push(...rolePermissions);
      }
    }

    // Remove duplicates
    return this.deduplicatePermissions(permissions);
  }

  /**
   * Get all permissions for a role (including inherited)
   */
  getRolePermissions(roleName: string): Permission[] {
    const role = this.roles.get(roleName);
    if (!role) return [];

    const permissions: Permission[] = [...role.permissions];

    // Add inherited permissions
    if (role.inherits) {
      for (const parentRoleName of role.inherits) {
        const parentPermissions = this.getRolePermissions(parentRoleName);
        permissions.push(...parentPermissions);
      }
    }

    return this.deduplicatePermissions(permissions);
  }

  /**
   * Check role hierarchy for circular dependencies
   */
  validateRoleHierarchy(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [roleName, role] of this.roles.entries()) {
      if (this.hasCircularDependency(roleName, new Set())) {
        errors.push(`Circular dependency detected in role: ${roleName}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get role hierarchy as a tree structure
   */
  getRoleHierarchy(): Record<string, string[]> {
    const hierarchy: Record<string, string[]> = {};

    for (const [roleName, role] of this.roles.entries()) {
      hierarchy[roleName] = role.inherits || [];
    }

    return hierarchy;
  }

  /**
   * Clear permission cache
   */
  clearPermissionCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRatio: number;
  } {
    // Simple cache stats (in production, you'd track hits/misses)
    return {
      size: this.permissionCache.size,
      hitRatio: 0, // Would need hit/miss tracking
    };
  }

  /**
   * Import roles from configuration
   */
  importRoles(roles: Role[]): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    for (const role of roles) {
      try {
        this.defineRole(role);
        imported++;
      } catch (error) {
        errors.push(
          `Failed to import role '${role.name}': ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    return { imported, errors };
  }

  /**
   * Export all roles
   */
  exportRoles(): Role[] {
    return this.getAllRoles();
  }

  /**
   * Internal permission check logic
   */
  private checkPermissionInternal(
    user: User,
    resource: string,
    action: string
  ): boolean {
    // Check direct permissions
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

    // Check role-based permissions
    if (user.roles) {
      for (const roleName of user.roles) {
        if (this.roleHasPermission(roleName, resource, action)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if role has permission (including inheritance)
   */
  private roleHasPermission(
    roleName: string,
    resource: string,
    action: string
  ): boolean {
    const role = this.roles.get(roleName);
    if (!role) return false;

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
        if (this.roleHasPermission(parentRoleName, resource, action)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Validate role definition
   */
  private validateRole(role: Role): void {
    if (!role.name || typeof role.name !== 'string') {
      throw new Error('Role name is required and must be a string');
    }

    if (!Array.isArray(role.permissions)) {
      throw new Error('Role permissions must be an array');
    }

    for (const permission of role.permissions) {
      if (!permission.resource || !permission.action) {
        throw new Error(
          'Each permission must have resource and action properties'
        );
      }
    }

    if (role.inherits) {
      if (!Array.isArray(role.inherits)) {
        throw new Error('Role inherits must be an array');
      }

      for (const parentRole of role.inherits) {
        if (parentRole === role.name) {
          throw new Error('Role cannot inherit from itself');
        }
      }
    }
  }

  /**
   * Check for circular dependencies in role hierarchy
   */
  private hasCircularDependency(
    roleName: string,
    visited: Set<string>
  ): boolean {
    if (visited.has(roleName)) return true;

    const role = this.roles.get(roleName);
    if (!role || !role.inherits) return false;

    visited.add(roleName);

    for (const parentRole of role.inherits) {
      if (this.hasCircularDependency(parentRole, new Set(visited))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate cache key for permission lookup
   */
  private getPermissionCacheKey(
    user: User,
    resource: string,
    action: string
  ): string {
    const userKey = `${user.id}:${(user.roles || []).sort().join(',')}:${(
      user.permissions || []
    )
      .sort()
      .join(',')}`;
    return `${userKey}:${resource}:${action}`;
  }

  /**
   * Remove duplicate permissions from array
   */
  private deduplicatePermissions(permissions: Permission[]): Permission[] {
    const seen = new Set<string>();
    return permissions.filter((perm) => {
      const key = `${perm.resource}:${perm.action}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

  editor: (): Role => ({
    name: 'editor',
    permissions: [
      { resource: 'articles', action: 'create' },
      { resource: 'articles', action: 'read' },
      { resource: 'articles', action: 'update' },
      { resource: 'comments', action: 'read' },
      { resource: 'comments', action: 'moderate' },
    ],
    inherits: ['user'],
  }),

  viewer: (): Role => ({
    name: 'viewer',
    permissions: [{ resource: '*', action: 'read' }],
  }),
};

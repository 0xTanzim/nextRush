/**
 * @nextrush/decorators - Guards Decorator Tests
 */

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller } from '../class.js';
import {
  getAllGuards,
  getClassGuards,
  getMethodGuards,
  UseGuard,
} from '../guards.js';
import { Get, Post } from '../routes.js';
import type { CanActivate, GuardContext, GuardFn } from '../types.js';
import { isGuardClass } from '../types.js';

describe('Guards Decorator', () => {
  describe('UseGuard', () => {
    it('should apply guards at class level', () => {
      const authGuard: GuardFn = () => true;

      @UseGuard(authGuard)
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      const guards = getClassGuards(UserController);
      expect(guards).toHaveLength(1);
      expect(guards[0]).toBe(authGuard);
    });

    it('should apply guards at method level', () => {
      const adminGuard: GuardFn = () => true;

      @Controller('/users')
      class UserController {
        @UseGuard(adminGuard)
        @Get('/admin')
        adminOnly() {
          return [];
        }

        @Get()
        publicRoute() {
          return [];
        }
      }

      const adminMethodGuards = getMethodGuards(UserController, 'adminOnly');
      const publicMethodGuards = getMethodGuards(UserController, 'publicRoute');

      expect(adminMethodGuards).toHaveLength(1);
      expect(adminMethodGuards[0]).toBe(adminGuard);
      expect(publicMethodGuards).toHaveLength(0);
    });

    it('should stack multiple guards on a single target', () => {
      const guard1: GuardFn = () => true;
      const guard2: GuardFn = () => true;
      const guard3: GuardFn = () => true;

      @UseGuard(guard1)
      @UseGuard(guard2)
      @UseGuard(guard3)
      @Controller('/protected')
      class ProtectedController {
        @Get()
        getData() {
          return {};
        }
      }

      const guards = getClassGuards(ProtectedController);
      // Guards are added in decorator order (bottom to top due to decorator application order)
      expect(guards).toHaveLength(3);
      expect(guards).toContain(guard1);
      expect(guards).toContain(guard2);
      expect(guards).toContain(guard3);
    });

    it('should apply multiple guards in a single decorator call', () => {
      const guard1: GuardFn = () => true;
      const guard2: GuardFn = () => true;

      @UseGuard(guard1, guard2)
      @Controller('/multi')
      class MultiGuardController {
        @Get()
        getData() {
          return {};
        }
      }

      const guards = getClassGuards(MultiGuardController);
      expect(guards).toHaveLength(2);
      expect(guards[0]).toBe(guard1);
      expect(guards[1]).toBe(guard2);
    });
  });

  describe('getAllGuards', () => {
    it('should combine class and method guards in correct order', () => {
      const classGuard: GuardFn = () => true;
      const methodGuard: GuardFn = () => false;

      @UseGuard(classGuard)
      @Controller('/combined')
      class CombinedController {
        @UseGuard(methodGuard)
        @Get()
        getData() {
          return {};
        }
      }

      const allGuards = getAllGuards(CombinedController, 'getData');

      // Class guards should come first, then method guards
      expect(allGuards).toHaveLength(2);
      expect(allGuards[0]).toBe(classGuard);
      expect(allGuards[1]).toBe(methodGuard);
    });

    it('should return empty array when no guards are defined', () => {
      @Controller('/no-guards')
      class NoGuardsController {
        @Get()
        getData() {
          return {};
        }
      }

      const guards = getAllGuards(NoGuardsController, 'getData');
      expect(guards).toHaveLength(0);
    });

    it('should return only class guards when method has no guards', () => {
      const classGuard: GuardFn = () => true;

      @UseGuard(classGuard)
      @Controller('/class-only')
      class ClassOnlyController {
        @Get()
        publicMethod() {
          return {};
        }
      }

      const guards = getAllGuards(ClassOnlyController, 'publicMethod');
      expect(guards).toHaveLength(1);
      expect(guards[0]).toBe(classGuard);
    });

    it('should return only method guards when class has no guards', () => {
      const methodGuard: GuardFn = () => true;

      @Controller('/method-only')
      class MethodOnlyController {
        @UseGuard(methodGuard)
        @Get()
        protectedMethod() {
          return {};
        }
      }

      const guards = getAllGuards(MethodOnlyController, 'protectedMethod');
      expect(guards).toHaveLength(1);
      expect(guards[0]).toBe(methodGuard);
    });
  });

  describe('Guard Function Types', () => {
    it('should accept sync guard functions', () => {
      const syncGuard: GuardFn = (ctx: GuardContext) => {
        return ctx.headers['x-api-key'] === 'secret';
      };

      @UseGuard(syncGuard)
      @Controller('/sync')
      class SyncController {
        @Get()
        getData() {
          return {};
        }
      }

      const guards = getClassGuards(SyncController);
      expect(guards[0]).toBe(syncGuard);
    });

    it('should accept async guard functions', () => {
      const asyncGuard: GuardFn = async (ctx: GuardContext) => {
        // Simulate async permission check
        await new Promise((resolve) => setTimeout(resolve, 1));
        return ctx.query['token'] === 'valid';
      };

      @UseGuard(asyncGuard)
      @Controller('/async')
      class AsyncController {
        @Get()
        getData() {
          return {};
        }
      }

      const guards = getClassGuards(AsyncController);
      expect(guards[0]).toBe(asyncGuard);
    });

    it('should work with named function guards', () => {
      function authenticationGuard(ctx: GuardContext): boolean {
        return Boolean(ctx.headers['authorization']);
      }

      function roleGuard(ctx: GuardContext): boolean {
        return ctx.state.role === 'admin';
      }

      @UseGuard(authenticationGuard, roleGuard)
      @Controller('/named')
      class NamedGuardController {
        @Get()
        getData() {
          return {};
        }
      }

      const guards = getClassGuards(NamedGuardController);
      expect(guards).toHaveLength(2);
      expect((guards[0] as GuardFn).name).toBe('authenticationGuard');
      expect((guards[1] as GuardFn).name).toBe('roleGuard');
    });
  });

  describe('Class-Based Guards (CanActivate)', () => {
    it('should accept class-based guards implementing CanActivate', () => {
      class AuthGuard implements CanActivate {
        canActivate(_ctx: GuardContext): boolean {
          return true;
        }
      }

      @UseGuard(AuthGuard)
      @Controller('/class-guard')
      class ClassGuardController {
        @Get()
        getData() {
          return {};
        }
      }

      const guards = getClassGuards(ClassGuardController);
      expect(guards).toHaveLength(1);
      expect(guards[0]).toBe(AuthGuard);
    });

    it('should correctly identify class guards with isGuardClass', () => {
      class AuthGuard implements CanActivate {
        canActivate(_ctx: GuardContext): boolean {
          return true;
        }
      }

      const funcGuard: GuardFn = () => true;

      expect(isGuardClass(AuthGuard)).toBe(true);
      expect(isGuardClass(funcGuard)).toBe(false);
    });

    it('should allow mixing function and class guards', () => {
      const funcGuard: GuardFn = () => true;

      class ClassGuard implements CanActivate {
        canActivate(_ctx: GuardContext): boolean {
          return true;
        }
      }

      @UseGuard(funcGuard, ClassGuard)
      @Controller('/mixed-guards')
      class MixedGuardController {
        @Get()
        getData() {
          return {};
        }
      }

      const guards = getClassGuards(MixedGuardController);
      expect(guards).toHaveLength(2);
      expect(isGuardClass(guards[0]!)).toBe(false);
      expect(isGuardClass(guards[1]!)).toBe(true);
    });

    it('should support class guards with async canActivate', () => {
      class AsyncClassGuard implements CanActivate {
        async canActivate(_ctx: GuardContext): Promise<boolean> {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return true;
        }
      }

      @UseGuard(AsyncClassGuard)
      @Controller('/async-class-guard')
      class AsyncClassGuardController {
        @Get()
        getData() {
          return {};
        }
      }

      const guards = getClassGuards(AsyncClassGuardController);
      expect(guards).toHaveLength(1);
      expect(isGuardClass(guards[0]!)).toBe(true);
    });

    it('should support class guards at method level', () => {
      class MethodGuard implements CanActivate {
        canActivate(_ctx: GuardContext): boolean {
          return true;
        }
      }

      @Controller('/method-class-guard')
      class MethodClassGuardController {
        @UseGuard(MethodGuard)
        @Get('/protected')
        protectedMethod() {
          return {};
        }

        @Get('/public')
        publicMethod() {
          return [];
        }
      }

      const protectedGuards = getMethodGuards(MethodClassGuardController, 'protectedMethod');
      const publicGuards = getMethodGuards(MethodClassGuardController, 'publicMethod');

      expect(protectedGuards).toHaveLength(1);
      expect(isGuardClass(protectedGuards[0]!)).toBe(true);
      expect(publicGuards).toHaveLength(0);
    });

    it('should combine class and method guards with mixed types', () => {
      const funcGuard: GuardFn = () => true;

      class ClassLevelGuard implements CanActivate {
        canActivate(_ctx: GuardContext): boolean {
          return true;
        }
      }

      class MethodLevelGuard implements CanActivate {
        canActivate(_ctx: GuardContext): boolean {
          return true;
        }
      }

      @UseGuard(ClassLevelGuard, funcGuard)
      @Controller('/mixed-level-guards')
      class MixedLevelController {
        @UseGuard(MethodLevelGuard)
        @Get()
        getData() {
          return {};
        }
      }

      const allGuards = getAllGuards(MixedLevelController, 'getData');
      expect(allGuards).toHaveLength(3);

      // Class guards first
      expect(isGuardClass(allGuards[0]!)).toBe(true);
      expect(isGuardClass(allGuards[1]!)).toBe(false);
      // Method guard last
      expect(isGuardClass(allGuards[2]!)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple methods with different guards', () => {
      const publicGuard: GuardFn = () => true;
      const adminGuard: GuardFn = () => false;
      const superAdminGuard: GuardFn = () => true;

      @Controller('/multi-method')
      class MultiMethodController {
        @UseGuard(publicGuard)
        @Get('/public')
        publicRoute() {
          return {};
        }

        @UseGuard(adminGuard)
        @Post('/admin')
        adminRoute() {
          return {};
        }

        @UseGuard(adminGuard, superAdminGuard)
        @Post('/super-admin')
        superAdminRoute() {
          return {};
        }
      }

      expect(getMethodGuards(MultiMethodController, 'publicRoute')).toHaveLength(1);
      expect(getMethodGuards(MultiMethodController, 'adminRoute')).toHaveLength(1);
      expect(getMethodGuards(MultiMethodController, 'superAdminRoute')).toHaveLength(2);
    });

    it('should not leak guards between unrelated classes', () => {
      const guard1: GuardFn = () => true;
      const guard2: GuardFn = () => false;

      @UseGuard(guard1)
      @Controller('/class-a')
      class ClassA {
        @Get()
        method() {
          return {};
        }
      }

      @UseGuard(guard2)
      @Controller('/class-b')
      class ClassB {
        @Get()
        method() {
          return {};
        }
      }

      expect(getClassGuards(ClassA)).toContain(guard1);
      expect(getClassGuards(ClassA)).not.toContain(guard2);

      expect(getClassGuards(ClassB)).toContain(guard2);
      expect(getClassGuards(ClassB)).not.toContain(guard1);
    });
  });
});

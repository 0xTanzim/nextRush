/**
 * @nextrush/decorators - Exception Filter Decorator Tests
 */

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller } from '../class.js';
import {
  Catch,
  getAllFilters,
  getCatchTypes,
  getClassFilters,
  getMethodFilters,
  UseFilter,
} from '../filters.js';
import { Get, Post } from '../routes.js';
import type { Context } from '@nextrush/types';
import type { ExceptionFilter } from '../types.js';

class DomainError extends Error {}
class OtherError extends Error {}

class DomainFilter implements ExceptionFilter {
  catch(_error: unknown, _ctx: Context): void {
    /* sets response */
  }
}

class CatchAllFilter implements ExceptionFilter {
  catch(_error: unknown, _ctx: Context): void {
    /* sets response */
  }
}

describe('Exception Filter Decorators', () => {
  describe('@Catch', () => {
    it('should store the error types the filter handles', () => {
      @Catch(DomainError, OtherError)
      class MultiFilter implements ExceptionFilter {
        catch(): void {}
      }

      const types = getCatchTypes(MultiFilter);
      expect(types).toHaveLength(2);
      expect(types[0]).toBe(DomainError);
      expect(types[1]).toBe(OtherError);
    });

    it('should treat no-arg @Catch() as a catch-all (empty types)', () => {
      @Catch()
      class AnyFilter implements ExceptionFilter {
        catch(): void {}
      }

      expect(getCatchTypes(AnyFilter)).toEqual([]);
    });

    it('should return an empty array for a filter with no @Catch metadata', () => {
      class BareFilter implements ExceptionFilter {
        catch(): void {}
      }

      expect(getCatchTypes(BareFilter)).toEqual([]);
    });
  });

  describe('@UseFilter', () => {
    it('should apply filters at the class level', () => {
      @UseFilter(DomainFilter)
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      const filters = getClassFilters(UserController);
      expect(filters).toHaveLength(1);
      expect(filters[0]).toBe(DomainFilter);
    });

    it('should apply filters at the method level', () => {
      @Controller('/users')
      class UserController {
        @UseFilter(DomainFilter)
        @Post()
        create() {
          return {};
        }

        @Get()
        findAll() {
          return [];
        }
      }

      expect(getMethodFilters(UserController, 'create')).toHaveLength(1);
      expect(getMethodFilters(UserController, 'create')[0]).toBe(DomainFilter);
      expect(getMethodFilters(UserController, 'findAll')).toHaveLength(0);
    });

    it('should apply multiple filters in a single decorator call', () => {
      @UseFilter(DomainFilter, CatchAllFilter)
      @Controller('/multi')
      class MultiController {
        @Get()
        getData() {
          return {};
        }
      }

      const filters = getClassFilters(MultiController);
      expect(filters).toHaveLength(2);
      expect(filters[0]).toBe(DomainFilter);
      expect(filters[1]).toBe(CatchAllFilter);
    });

    it('should not leak filters between unrelated classes', () => {
      @UseFilter(DomainFilter)
      @Controller('/a')
      class ControllerA {
        @Get()
        method() {
          return {};
        }
      }

      @UseFilter(CatchAllFilter)
      @Controller('/b')
      class ControllerB {
        @Get()
        method() {
          return {};
        }
      }

      expect(getClassFilters(ControllerA)).toContain(DomainFilter);
      expect(getClassFilters(ControllerA)).not.toContain(CatchAllFilter);
      expect(getClassFilters(ControllerB)).toContain(CatchAllFilter);
      expect(getClassFilters(ControllerB)).not.toContain(DomainFilter);
    });
  });

  describe('getAllFilters', () => {
    it('should return method filters before class filters (precedence order)', () => {
      @UseFilter(CatchAllFilter)
      @Controller('/combined')
      class CombinedController {
        @UseFilter(DomainFilter)
        @Get()
        getData() {
          return {};
        }
      }

      const all = getAllFilters(CombinedController, 'getData');
      expect(all).toHaveLength(2);
      // Method-level filter first (higher precedence), then class-level.
      expect(all[0]).toBe(DomainFilter);
      expect(all[1]).toBe(CatchAllFilter);
    });

    it('should return an empty array when no filters are defined', () => {
      @Controller('/none')
      class NoFilterController {
        @Get()
        getData() {
          return {};
        }
      }

      expect(getAllFilters(NoFilterController, 'getData')).toHaveLength(0);
    });
  });
});

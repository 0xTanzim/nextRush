/**
 * @nextrush/class - Interceptor Decorator Tests
 *
 * Mirrors the guard/filter decorator tests: metadata is stored at class and
 * method level, stacks bottom-to-top (TypeScript decorator order), and
 * getAllInterceptors returns class interceptors first (outermost), then method
 * interceptors (innermost) — the onion order the controllers runtime relies on.
 */

import type { Context } from '@nextrush/types';
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller } from '../decorators/class.js';
import {
  getAllInterceptors,
  getClassInterceptors,
  getMethodInterceptors,
  UseInterceptor,
} from '../interceptors/interceptors.js';
import { Get } from '../decorators/routes.js';
import type { Interceptor } from '../types.js';

class LogInterceptor implements Interceptor {
  async intercept(_ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
    return next();
  }
}

class WrapInterceptor implements Interceptor {
  async intercept(_ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
    return next();
  }
}

describe('Interceptor Decorator', () => {
  it('applies interceptors at class level', () => {
    @UseInterceptor(LogInterceptor)
    @Controller('/users')
    class UserController {
      @Get()
      findAll() {
        return [];
      }
    }

    expect(getClassInterceptors(UserController)).toEqual([LogInterceptor]);
  });

  it('applies interceptors at method level', () => {
    @Controller('/users')
    class UserController {
      @UseInterceptor(WrapInterceptor)
      @Get('/:id')
      findOne() {
        return {};
      }

      @Get()
      list() {
        return [];
      }
    }

    expect(getMethodInterceptors(UserController, 'findOne')).toEqual([WrapInterceptor]);
    expect(getMethodInterceptors(UserController, 'list')).toEqual([]);
  });

  it('stacks multiple interceptors in bottom-to-top decorator order', () => {
    @UseInterceptor(LogInterceptor)
    @UseInterceptor(WrapInterceptor)
    @Controller('/x')
    class X {
      @Get()
      g() {
        return {};
      }
    }

    expect(getClassInterceptors(X)).toEqual([WrapInterceptor, LogInterceptor]);
  });

  it('getAllInterceptors returns class interceptors first, then method (onion order)', () => {
    @UseInterceptor(LogInterceptor)
    @Controller('/x')
    class X {
      @UseInterceptor(WrapInterceptor)
      @Get()
      g() {
        return {};
      }
    }

    expect(getAllInterceptors(X, 'g')).toEqual([LogInterceptor, WrapInterceptor]);
  });

  it('accepts multiple interceptors in a single decorator call', () => {
    @UseInterceptor(LogInterceptor, WrapInterceptor)
    @Controller('/x')
    class X {
      @Get()
      g() {
        return {};
      }
    }

    expect(getClassInterceptors(X)).toEqual([LogInterceptor, WrapInterceptor]);
  });
});

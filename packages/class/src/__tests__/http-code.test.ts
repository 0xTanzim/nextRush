/**
 * @nextrush/class - @HttpCode Tests
 */

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller } from '../decorators/class.js';
import { HttpCode } from '../decorators/http-code.js';
import { getHttpCode } from '../metadata/metadata.js';
import { Get, Post } from '../decorators/routes.js';

describe('@HttpCode', () => {
  it('stores the status code for the decorated method', () => {
    @Controller('/users')
    class UserController {
      @Post()
      @HttpCode(201)
      create() {
        return {};
      }
    }

    expect(getHttpCode(UserController, 'create')).toBe(201);
  });

  it('returns undefined for a method without @HttpCode', () => {
    @Controller('/users')
    class UserController {
      @Get()
      findAll() {
        return [];
      }
    }

    expect(getHttpCode(UserController, 'findAll')).toBeUndefined();
  });

  it('stores independent codes per method', () => {
    @Controller('/users')
    class UserController {
      @Post()
      @HttpCode(201)
      create() {
        return {};
      }

      @Post('/accept')
      @HttpCode(202)
      accept() {
        return {};
      }
    }

    expect(getHttpCode(UserController, 'create')).toBe(201);
    expect(getHttpCode(UserController, 'accept')).toBe(202);
  });
});

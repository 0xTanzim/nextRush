/**
 * @nextrush/decorators - Parameter Decorator Tests
 */

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller } from '../class.js';
import { getParamMetadata } from '../metadata.js';
import { Body, Ctx, Header, Param, Query, Req, Res } from '../params.js';
import { Get, Post } from '../routes.js';

describe('Parameter Decorators', () => {
  describe('@Body', () => {
    it('should register body parameter without name', () => {
      @Controller('/users')
      class UserController {
        @Post()
        create(@Body() data: unknown) {
          return data;
        }
      }

      const params = getParamMetadata(UserController, 'create');
      expect(params).toHaveLength(1);
      expect(params[0].source).toBe('body');
      expect(params[0].index).toBe(0);
      expect(params[0].name).toBeUndefined();
      expect(params[0].required).toBe(true);
    });

    it('should register body parameter with property name', () => {
      @Controller('/users')
      class UserController {
        @Post()
        updateEmail(@Body('email') email: string) {
          return email;
        }
      }

      const params = getParamMetadata(UserController, 'updateEmail');
      expect(params[0].name).toBe('email');
    });

    it('should register body parameter with options', () => {
      const transform = (v: unknown) => v;

      @Controller('/users')
      class UserController {
        @Post()
        create(@Body({ required: false, transform }) data: unknown) {
          return data;
        }
      }

      const params = getParamMetadata(UserController, 'create');
      expect(params[0].required).toBe(false);
      expect(params[0].transform).toBe(transform);
    });
  });

  describe('@Param', () => {
    it('should register param without name (all params)', () => {
      @Controller('/users')
      class UserController {
        @Get('/:id')
        findOne(@Param() params: Record<string, string>) {
          return params;
        }
      }

      const params = getParamMetadata(UserController, 'findOne');
      expect(params[0].source).toBe('param');
      expect(params[0].name).toBeUndefined();
      expect(params[0].required).toBe(true);
    });

    it('should register param with name', () => {
      @Controller('/users')
      class UserController {
        @Get('/:id')
        findOne(@Param('id') id: string) {
          return id;
        }
      }

      const params = getParamMetadata(UserController, 'findOne');
      expect(params[0].name).toBe('id');
    });

    it('should register param with transform', () => {
      @Controller('/users')
      class UserController {
        @Get('/:id')
        findOne(@Param('id', { transform: Number }) id: number) {
          return id;
        }
      }

      const params = getParamMetadata(UserController, 'findOne');
      expect(params[0].transform).toBe(Number);
    });
  });

  describe('@Query', () => {
    it('should register query without name (all query params)', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll(@Query() query: Record<string, string>) {
          return query;
        }
      }

      const params = getParamMetadata(UserController, 'findAll');
      expect(params[0].source).toBe('query');
      expect(params[0].required).toBe(false);
    });

    it('should register query with name', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll(@Query('page') page: string) {
          return page;
        }
      }

      const params = getParamMetadata(UserController, 'findAll');
      expect(params[0].name).toBe('page');
    });

    it('should register query with default value', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll(@Query('limit', { defaultValue: 10 }) limit: number) {
          return limit;
        }
      }

      const params = getParamMetadata(UserController, 'findAll');
      expect(params[0].defaultValue).toBe(10);
    });
  });

  describe('@Header', () => {
    it('should register header without name (all headers)', () => {
      @Controller('/api')
      class ApiController {
        @Get()
        handle(@Header() headers: Record<string, string>) {
          return headers;
        }
      }

      const params = getParamMetadata(ApiController, 'handle');
      expect(params[0].source).toBe('header');
      expect(params[0].required).toBe(false);
    });

    it('should register header with name', () => {
      @Controller('/api')
      class ApiController {
        @Get()
        handle(@Header('authorization') auth: string) {
          return auth;
        }
      }

      const params = getParamMetadata(ApiController, 'handle');
      expect(params[0].name).toBe('authorization');
    });

    it('should register header with default value', () => {
      @Controller('/api')
      class ApiController {
        @Get()
        handle(@Header('x-api-version', { defaultValue: 'v1' }) version: string) {
          return version;
        }
      }

      const params = getParamMetadata(ApiController, 'handle');
      expect(params[0].defaultValue).toBe('v1');
    });
  });

  describe('@Ctx', () => {
    it('should register ctx parameter', () => {
      @Controller('/users')
      class UserController {
        @Get('/:id')
        findOne(@Ctx() ctx: unknown) {
          return ctx;
        }
      }

      const params = getParamMetadata(UserController, 'findOne');
      expect(params[0].source).toBe('ctx');
      expect(params[0].index).toBe(0);
    });
  });

  describe('@Req', () => {
    it('should register req parameter', () => {
      @Controller('/files')
      class FileController {
        @Post('/upload')
        upload(@Req() req: unknown) {
          return req;
        }
      }

      const params = getParamMetadata(FileController, 'upload');
      expect(params[0].source).toBe('req');
    });
  });

  describe('@Res', () => {
    it('should register res parameter', () => {
      @Controller('/files')
      class FileController {
        @Get('/download')
        download(@Res() res: unknown) {
          return res;
        }
      }

      const params = getParamMetadata(FileController, 'download');
      expect(params[0].source).toBe('res');
    });
  });

  describe('Multiple parameters', () => {
    it('should collect parameters in correct order', () => {
      @Controller('/users')
      class UserController {
        @Get('/:id')
        findOne(@Param('id') id: string, @Query('include') include: string, @Header('authorization') auth: string) {
          return { id, include, auth };
        }
      }

      const params = getParamMetadata(UserController, 'findOne');
      expect(params).toHaveLength(3);

      const paramParam = params.find((p) => p.source === 'param');
      const queryParam = params.find((p) => p.source === 'query');
      const headerParam = params.find((p) => p.source === 'header');

      expect(paramParam?.index).toBe(0);
      expect(queryParam?.index).toBe(1);
      expect(headerParam?.index).toBe(2);
    });

    it('should handle parameters on different methods independently', () => {
      @Controller('/users')
      class UserController {
        @Get('/:id')
        findOne(@Param('id') id: string) {
          return id;
        }

        @Post()
        create(@Body() data: unknown) {
          return data;
        }
      }

      const findOneParams = getParamMetadata(UserController, 'findOne');
      const createParams = getParamMetadata(UserController, 'create');

      expect(findOneParams).toHaveLength(1);
      expect(findOneParams[0].source).toBe('param');

      expect(createParams).toHaveLength(1);
      expect(createParams[0].source).toBe('body');
    });
  });

  describe('Error handling', () => {
    it('should throw when used on constructor parameter', () => {
      expect(() => {
        @Controller('/users')
        class UserController {
          constructor(@Body() data: unknown) {
            console.log(data);
          }
        }

        return UserController;
      }).toThrow('can only be used on method parameters');
    });
  });
});

import {
  Body,
  Controller,
  Ctx,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  SetHeader,
  UseGuard,
} from '@nextrush/decorators';
import type { Context } from 'nextrush';
import { AuthGuard } from '../guards/auth.guard.js';
import { UserService } from '../services/user.service.js';

/**
 * UserController — Full CRUD testing:
 * - Constructor DI with @Service dependency
 * - All HTTP method decorators (@Get, @Post, @Put, @Delete)
 * - Parameter decorators (@Param, @Body, @Query, @Header, @Ctx)
 * - Parameter transforms (Param('id', { transform: Number }))
 * - Function guard (@UseGuard with AuthGuard)
 * - Response headers (@SetHeader)
 * - Return value auto-serialization
 */
@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}

  /**
   * GET /api/users
   * Tests: @Query param, return auto-serialization
   */
  @Get()
  @SetHeader('X-Total-Count', '3')
  findAll(@Query('page') page: string, @Query('limit') limit: string) {
    const users = this.userService.findAll();
    return {
      data: users,
      pagination: {
        page: page ?? '1',
        limit: limit ?? '10',
      },
    };
  }

  /**
   * GET /api/users/:id
   * Tests: @Param with transform (string → number), DI service call
   */
  @Get('/:id')
  findById(@Param('id', { transform: Number }) id: number) {
    const user = this.userService.findById(id);
    if (!user) {
      return { error: 'User not found', status: 404 };
    }
    return user;
  }

  /**
   * POST /api/users
   * Tests: @Body() full body injection, guard (AuthGuard)
   */
  @Post()
  @UseGuard(AuthGuard)
  create(@Body() data: { name: string; email: string }) {
    const user = this.userService.create(data);
    return { created: true, user };
  }

  /**
   * PUT /api/users/:id
   * Tests: @Param + @Body combined, guard
   */
  @Put('/:id')
  @UseGuard(AuthGuard)
  update(
    @Param('id', { transform: Number }) id: number,
    @Body() data: { name?: string; email?: string }
  ) {
    const user = this.userService.update(id, data);
    if (!user) {
      return { error: 'User not found', status: 404 };
    }
    return { updated: true, user };
  }

  /**
   * DELETE /api/users/:id
   * Tests: @Delete, @Param, guard
   */
  @Delete('/:id')
  @UseGuard(AuthGuard)
  remove(@Param('id', { transform: Number }) id: number) {
    const deleted = this.userService.delete(id);
    return { deleted };
  }

  /**
   * GET /api/users/ctx-test
   * Tests: @Ctx() full context injection, @Header() specific header
   */
  @Get('/ctx-test')
  ctxTest(@Ctx() ctx: Context, @Header('user-agent') userAgent: string) {
    return {
      method: ctx.method,
      path: ctx.path,
      userAgent: userAgent ?? 'unknown',
    };
  }
}

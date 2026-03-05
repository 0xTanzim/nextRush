import {
  Body,
  Controller,
  createCustomParamDecorator,
  Get,
  Param,
  Post,
  UseGuard,
} from '@nextrush/decorators';
import { inject, Optional } from '@nextrush/di';
import { AdminGuard } from '../guards/auth.guard.js';
import { ItemRepository } from '../services/item.repository.js';
import type { ILogger } from '../services/logger.service.js';

/**
 * Custom parameter decorator — extracts request timestamp.
 * Tests: createCustomParamDecorator + async extractor (P0 fix)
 */
const RequestTimestamp = createCustomParamDecorator(
  async (_ctx) => {
    // Simulate async extraction (e.g., from a database or external service)
    return Promise.resolve(new Date().toISOString());
  },
  { required: false }
);

/**
 * Custom parameter decorator — extracts client IP.
 * Tests: sync custom extractor
 */
const ClientIP = createCustomParamDecorator((ctx) => ctx.get('x-forwarded-for') ?? 'unknown');

/**
 * ItemController — Advanced feature testing:
 * - @Repository() dependency injection
 * - @Optional() decorator (P0 fix validation)
 * - Class-based guard (AdminGuard)
 * - createCustomParamDecorator (sync + async)
 * - Parameter transform
 */
@Controller('/items')
export class ItemController {
  constructor(
    private itemRepo: ItemRepository,
    @Optional() @inject('UNREGISTERED_LOGGER') private logger?: ILogger
  ) {}

  /**
   * GET /api/items
   * Tests: @Repository DI, @Optional (logger should be undefined)
   */
  @Get()
  findAll() {
    // This validates @Optional — logger is NOT registered, so it should be undefined
    const loggerStatus = this.logger ? 'present' : 'undefined (expected)';

    return {
      items: this.itemRepo.findAll(),
      optionalLoggerStatus: loggerStatus,
    };
  }

  /**
   * GET /api/items/:id
   * Tests: @Param with transform, async custom param decorator
   */
  @Get('/:id')
  findById(@Param('id', { transform: Number }) id: number, @RequestTimestamp timestamp: string) {
    const item = this.itemRepo.findById(id);
    if (!item) {
      return { error: 'Item not found', timestamp };
    }
    return { ...item, fetchedAt: timestamp };
  }

  /**
   * POST /api/items
   * Tests: AdminGuard (class-based), @Body, sync custom param
   */
  @Post()
  @UseGuard(AdminGuard)
  create(@Body() data: { name: string; price: number }, @ClientIP clientIp: string) {
    const item = this.itemRepo.create(data);
    return { created: true, item, createdBy: clientIp };
  }
}

import { Controller, Get, SetHeader } from '@nextrush/decorators';

/**
 * HealthController — Simple controller for basic functionality testing:
 * - @SetHeader response header decorator
 * - Return value auto-serialization
 * - No DI dependencies (standalone)
 */
@Controller('/health')
export class HealthController {
  /**
   * GET /api/health
   * Tests: basic controller, @SetHeader, auto-JSON return
   */
  @Get()
  @SetHeader('Cache-Control', 'no-cache')
  @SetHeader('X-Health-Check', 'true')
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '3.0.2',
    };
  }

  /**
   * GET /api/health/ready
   * Tests: sub-route on controller
   */
  @Get('/ready')
  readiness() {
    return { ready: true };
  }
}

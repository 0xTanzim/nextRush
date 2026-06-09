import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Controller, Get, SetHeader } from '@nextrush/decorators';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'));

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
      version: pkg.version,
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

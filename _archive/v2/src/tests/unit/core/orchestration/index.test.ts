/**
 * Tests for Orchestration Index
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

describe('Orchestration Module Exports', () => {
  it('should export ApplicationOrchestrator', async () => {
    const { ApplicationOrchestrator } = await import('@/core/orchestration');

    expect(ApplicationOrchestrator).toBeDefined();
    expect(typeof ApplicationOrchestrator).toBe('function');
  });

  it('should export MiddlewareChain', async () => {
    const { MiddlewareChain } = await import('@/core/orchestration');

    expect(MiddlewareChain).toBeDefined();
    expect(typeof MiddlewareChain).toBe('function');
  });

  it('should export RouteRegistry and RouteMatch type', async () => {
    const { RouteRegistry } = await import('@/core/orchestration');

    expect(RouteRegistry).toBeDefined();
    expect(typeof RouteRegistry).toBe('function');
  });

  it('should export ServerManager', async () => {
    const { ServerManager } = await import('@/core/orchestration');

    expect(ServerManager).toBeDefined();
    expect(typeof ServerManager).toBe('function');
  });

  it('should export all expected components', async () => {
    const exports = await import('@/core/orchestration');

    expect(Object.keys(exports)).toEqual(
      expect.arrayContaining([
        'ApplicationOrchestrator',
        'MiddlewareChain',
        'RouteRegistry',
        'ServerManager',
      ])
    );
  });
});

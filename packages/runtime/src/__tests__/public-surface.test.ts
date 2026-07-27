/**
 * @nextrush/runtime - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as runtimeApi from '../index';
import {
  BunProfile,
  CloudflareProfile,
  DEFAULT_BODY_LIMIT,
  DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  DenoDeployProfile,
  DenoProfile,
  EdgeProfile,
  LambdaProfile,
  METHODS_WITHOUT_BODY,
  NodeProfile,
  VercelEdgeProfile,
} from '../index';
import type {
  BodySource,
  BodySourceOptions,
  CapabilityProfile,
  ClientIpOptions,
  CombinedAbort,
  EdgeRuntimeInfo,
  HeaderLookup,
  ProxyTrust,
  Runtime,
  RuntimeCapabilities,
  RuntimeInfo,
  ServerStartErrorCode,
} from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(runtimeApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      // Runtime detection
      'detectEdgeRuntime',
      'detectPlatform',
      'detectRuntime',
      'capabilitiesFor',
      'getRuntime',
      'getRuntimeCapabilities',
      'getRuntimeInfo',
      'getRuntimeVersion',
      'isBun',
      'isDeno',
      'isEdge',
      'isNode',
      'isRuntime',
      'resetRuntimeCache',

      // Named capability profiles
      'BunProfile',
      'CloudflareProfile',
      'DenoDeployProfile',
      'DenoProfile',
      'EdgeProfile',
      'LambdaProfile',
      'NodeProfile',
      'VercelEdgeProfile',
      'capabilityProfileFor',

      // Query string parsing
      'parseQueryString',

      // Constants
      'DEFAULT_KEEP_ALIVE_TIMEOUT_MS',
      'DEFAULT_SHUTDOWN_TIMEOUT_MS',
      'DEFAULT_TIMEOUT_MS',
      'METHODS_WITHOUT_BODY',

      // Headers utilities
      'getClientIp',
      'getEdgeClientIp',
      'headersToRecord',
      'isTrustedPeer',
      'isValidClientIp',
      'resolveByHopCount',
      'resolveByPeerList',
      'resolveClientIp',

      // Request signal
      'combineAbortSignal',
      'deriveDeadlineSignal',

      // Server startup errors
      'normalizeStartupError',
      'ServerStartError',

      // Web response builder
      'assertHeaderSafe',
      'isBodylessResponse',
      'jsonErrorResponse',
      'WebResponseBuilder',

      // Shared Web Context base (F-08, ADR-0010)
      'WebContextBase',

      // Body source
      'AbstractBodySource',
      'BodyConsumedError',
      'BodyTooLargeError',
      'RequestAbortedError',
      'DEFAULT_BODY_LIMIT',
      'EmptyBodySource',
      'WebBodySource',
      'createEmptyBodySource',
      'createWebBodySource',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof DEFAULT_TIMEOUT_MS).toBe('number');
    expect(typeof DEFAULT_KEEP_ALIVE_TIMEOUT_MS).toBe('number');
    expect(typeof DEFAULT_SHUTDOWN_TIMEOUT_MS).toBe('number');
    expect(METHODS_WITHOUT_BODY instanceof Set).toBe(true);
    expect(typeof DEFAULT_BODY_LIMIT).toBe('number');
    expect(NodeProfile).toBeDefined();
    expect(BunProfile).toBeDefined();
    expect(DenoProfile).toBeDefined();
    expect(DenoDeployProfile).toBeDefined();
    expect(EdgeProfile).toBeDefined();
    expect(CloudflareProfile).toBeDefined();
    expect(VercelEdgeProfile).toBeDefined();
    expect(LambdaProfile).toBeDefined();
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [
      BodySource,
      BodySourceOptions,
      Runtime,
      RuntimeCapabilities,
      RuntimeInfo,
      EdgeRuntimeInfo,
      CapabilityProfile,
      ClientIpOptions,
      HeaderLookup,
      ProxyTrust,
      CombinedAbort,
      ServerStartErrorCode,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});

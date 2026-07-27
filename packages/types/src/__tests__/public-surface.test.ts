/**
 * @nextrush/types - Public API surface test (type-level)
 *
 * `@nextrush/types` is (almost) entirely `export type` — those don't appear in
 * `Object.keys()`, so the runtime-export-list pattern used by
 * `packages/class/src/__tests__/public-surface.test.ts` can't lock this
 * package's surface. This test locks the TYPE surface instead: every name
 * listed below must remain importable from the barrel with its current kind
 * (value vs type-only). If a name is removed or renamed, this file fails to
 * type-check — the same protection, at the type layer.
 *
 * Task 1a.2 (openspec/changes/harden-runtime-edge-serverless): the repo-wide
 * surface-snapshot harness (roadmap T005) doesn't exist yet — it's a separate,
 * larger change (T005 -> T053 -> T060, the v1.0 freeze gate). This file covers
 * 1a.2's actual ask now, for this package, using the pattern already
 * established by `@nextrush/class`; when T005 lands repo-wide, it can either
 * subsume this file or import from it.
 */

import { describe, expect, expectTypeOf, it } from 'vitest';
import * as typesApi from '../index';

// Runtime (value) exports — the only ones Object.keys() can see.
import { ContentType, HTTP_METHODS, HttpStatus, ROUTE_METADATA, SECURITY_AUDIT } from '../index';

// Type-only exports — locked by assignability, not Object.keys().
import type {
  AdapterContext,
  AdapterContextFactory,
  AuditableMiddleware,
  BaseStreamWriter,
  BodySource,
  BodySourceOptions,
  ClassProvider,
  CommonHttpMethod,
  Constructor,
  Container,
  Context,
  ContextOptions,
  ContextState,
  ContentTypeValue,
  Extension,
  ExtensionContext,
  ExtensionHost,
  FactoryProvider,
  FetchAdapter,
  FetchContext,
  FetchHandler,
  FetchHandlerOptions,
  HandlerOptions,
  HttpMethod,
  HttpStatusCode,
  InferOutput,
  IncomingHeaders,
  Logger,
  MetadataContribution,
  Middleware,
  NDJSONStreamWriter,
  Next,
  NodeStreamLike,
  OutgoingHeaders,
  ParsedBody,
  Provider,
  QueryParams,
  RawHttp,
  RegisterOptions,
  ResponseBody,
  Route,
  RouteDefinition,
  RouteEntry,
  RouteHandler,
  RouteMatch,
  RouteMetadata,
  RouteMetaMarker,
  RouteParam,
  RouteParams,
  RoutePattern,
  Router,
  RouterOptions,
  Runtime,
  RuntimeCapabilities,
  RuntimeInfo,
  Scope,
  SecurityAuditCheck,
  SecurityAudited,
  SecurityAuditVerdict,
  ServerAdapter,
  ServerAddress,
  ServerHandle,
  ServiceOptions,
  SSEEvent,
  SSEStreamWriter,
  StandardSchemaIssue,
  StandardSchemaPathSegment,
  StandardSchemaProps,
  StandardSchemaResult,
  StandardSchemaV1,
  StreamRun,
  StreamSource,
  TextStreamWriter,
  Token,
  ValueProvider,
  WebStreamLike,
} from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(typesApi).sort();

    // SEALED: everything else in the barrel is `export type` and invisible here.
    const expectedRuntime = [
      'ContentType',
      'HTTP_METHODS',
      'HttpStatus',
      'ROUTE_METADATA',
      'SECURITY_AUDIT',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    // Reference the imports so an accidental removal is a compile error too.
    expect(typeof ContentType).toBe('object');
    expect(typeof HttpStatus).toBe('object');
    expect(Array.isArray(HTTP_METHODS)).toBe(true);
    expect(typeof ROUTE_METADATA).toBe('symbol');
    expect(typeof SECURITY_AUDIT).toBe('symbol');
  });
});

describe('Public API surface (type-only exports, incl. runtime-adapter-contract)', () => {
  it('the adapter contract triad stays importable from the barrel', () => {
    // The three types this change (openspec/changes/harden-runtime-edge-serverless,
    // task group 1) promoted to an enforced public contract.
    expectTypeOf<ServerAdapter<object, object>>().not.toBeNever();
    expectTypeOf<FetchAdapter<object>>().not.toBeNever();
    expectTypeOf<AdapterContextFactory<readonly unknown[]>>().not.toBeNever();
  });

  it('every other listed type-only export remains importable from the barrel', () => {
    // A compile-time-only check: if any name above is removed/renamed from
    // `packages/types/src/index.ts`, the import block fails to type-check and
    // this whole test file fails to compile — the surface-lock signal.
    type Surface = [
      AdapterContext,
      AuditableMiddleware,
      BaseStreamWriter,
      BodySource,
      BodySourceOptions,
      ClassProvider<object>,
      CommonHttpMethod,
      Constructor,
      Container,
      Context,
      ContextOptions,
      ContextState,
      ContentTypeValue,
      Extension,
      ExtensionContext,
      ExtensionHost,
      FactoryProvider<object>,
      FetchContext,
      FetchHandler,
      FetchHandlerOptions,
      HandlerOptions,
      HttpMethod,
      HttpStatusCode,
      InferOutput<never>,
      IncomingHeaders,
      Logger,
      MetadataContribution,
      Middleware,
      NDJSONStreamWriter,
      Next,
      NodeStreamLike,
      OutgoingHeaders,
      ParsedBody,
      Provider<object>,
      QueryParams,
      RawHttp,
      RegisterOptions,
      ResponseBody,
      Route,
      RouteDefinition,
      RouteEntry,
      RouteHandler,
      RouteMatch,
      RouteMetadata,
      RouteMetaMarker,
      RouteParam,
      RouteParams,
      RoutePattern,
      Router,
      RouterOptions,
      Runtime,
      RuntimeCapabilities,
      RuntimeInfo,
      Scope,
      SecurityAuditCheck,
      SecurityAudited,
      SecurityAuditVerdict,
      ServerAddress,
      ServerHandle,
      ServiceOptions,
      SSEEvent,
      SSEStreamWriter,
      StandardSchemaIssue,
      StandardSchemaPathSegment,
      StandardSchemaProps,
      StandardSchemaResult<unknown>,
      StandardSchemaV1,
      StreamRun<BaseStreamWriter>,
      StreamSource<unknown>,
      TextStreamWriter,
      Token,
      ValueProvider<object>,
      WebStreamLike,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});

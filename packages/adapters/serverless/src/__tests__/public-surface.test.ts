/**
 * @nextrush/adapter-serverless - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as adapterServerlessApi from '../index';
import type {
  ApiGatewayV1Event,
  ApiGatewayV1Result,
  ApiGatewayV2Event,
  ApiGatewayV2Result,
  AwsLambdaStreaming,
  AzureEvent,
  AzureHttpRequestLike,
  AzureHttpResponseLike,
  AzureResult,
  EventMapper,
  GcfEvent,
  GcfHttpRequest,
  GcfHttpResponse,
  GcfResult,
  LambdaEvent,
  LambdaFunctionUrlEvent,
  LambdaFunctionUrlResult,
  LambdaResponseStream,
  LambdaResult,
  LambdaStreamMetadata,
  ServerlessAdapterOptions,
  ServerlessHandler,
  ServerlessHandlerOptions,
  StreamingLambdaHandler,
} from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(adapterServerlessApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      // Tier 1: per-provider handlers (what 95% of users import)
      'createLambdaHandler',
      'createGoogleHandler',
      'createGcfHandler',
      'createAzureHandler',
      'createLambdaStreamingHandler',

      // Advanced / Runtime authors only (Tier 3)
      'createServerlessAdapter',
      'createGoogleEventHandler',
      'createAzureEventHandler',
      'toGcfEvent',
      'writeGcfResult',
      'toAzureEvent',
      'toAzureResponse',

      // Built-in mappers (Tier 3 building blocks)
      'lambdaFunctionUrl',
      'apigwV2',
      'apigwV1',
      'gcf',
      'azure',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [
      LambdaEvent,
      LambdaResult,
      AwsLambdaStreaming,
      LambdaResponseStream,
      LambdaStreamMetadata,
      StreamingLambdaHandler,
      ServerlessHandlerOptions,
      EventMapper<object, object>,
      ServerlessAdapterOptions,
      ServerlessHandler,
      LambdaFunctionUrlEvent,
      LambdaFunctionUrlResult,
      ApiGatewayV2Event,
      ApiGatewayV2Result,
      ApiGatewayV1Event,
      ApiGatewayV1Result,
      GcfEvent,
      GcfResult,
      AzureEvent,
      AzureResult,
      GcfHttpRequest,
      GcfHttpResponse,
      AzureHttpRequestLike,
      AzureHttpResponseLike,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});

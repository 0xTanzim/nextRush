/**
 * @nextrush/adapter-serverless - AWS Lambda (Tier 1 handler).
 *
 * The one-liner most users want:
 *
 * ```typescript
 * import { createLambdaHandler } from '@nextrush/adapter-serverless';
 * export const handler = createLambdaHandler(app);
 * ```
 *
 * Zero config: it bundles the AWS mappers and auto-detects Lambda Function URL /
 * API Gateway HTTP API (payload format 2.0) vs API Gateway REST (1.0) per
 * invocation — the user never names a mapper or a provider. The `EventMapper`
 * plumbing underneath is Tier 3 (runtime authors only).
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';
import { createServerlessAdapter } from './adapter';
import {
  apigwV1,
  type ApiGatewayV1Event,
  type ApiGatewayV1Result,
} from './mappers/apigw-v1';
import {
  lambdaFunctionUrl,
  type LambdaFunctionUrlEvent,
  type LambdaFunctionUrlResult,
} from './mappers/lambda-function-url';
import type { EventMapper, ServerlessHandler, ServerlessHandlerOptions } from './types';

/** Any AWS Lambda HTTP event `createLambdaHandler` accepts (v2 or v1 shape). */
export type LambdaEvent = LambdaFunctionUrlEvent | ApiGatewayV1Event;
/** The corresponding AWS Lambda result shape. */
export type LambdaResult = LambdaFunctionUrlResult | ApiGatewayV1Result;

// Function URL / HTTP API (v2) and REST API (v1) have mutually-exclusive detect
// signatures (`version === '2.0'` vs `httpMethod` + `multiValueHeaders`), so
// detection is unambiguous with no explicit provider.
const lambdaMappers: readonly EventMapper<LambdaEvent, LambdaResult>[] = [
  lambdaFunctionUrl,
  apigwV1,
];

/**
 * Create an AWS Lambda handler for a NextRush app. Serves Lambda Function URL,
 * API Gateway HTTP API (v2), and API Gateway REST API (v1) with zero config.
 *
 * @param app - The NextRush application.
 * @param options - Optional Tier-2 tuning ({@link ServerlessHandlerOptions}).
 * @returns A Lambda handler `(event, context?) => Promise<result>`.
 *
 * @see {@link createLambdaStreamingHandler} for true Function URL response streaming —
 * buffered vs. streaming is a different handler, not an option on this one.
 *
 * @example
 * ```typescript
 * export const handler = createLambdaHandler(app);
 * // with tuning:
 * export const handler = createLambdaHandler(app, { timeout: 5000 });
 * ```
 */
export function createLambdaHandler(
  app: Application,
  options: ServerlessHandlerOptions = {}
): ServerlessHandler<LambdaEvent, LambdaResult> {
  return createServerlessAdapter<LambdaEvent, LambdaResult>({
    mappers: lambdaMappers,
    platform: 'lambda',
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
  }).createHandler(app);
}

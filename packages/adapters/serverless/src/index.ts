/**
 * @nextrush/adapter-serverless - Serverless adapter for NextRush
 *
 * Deploy a NextRush app to a serverless platform in one line:
 *
 * ```typescript
 * import { createLambdaHandler } from '@nextrush/adapter-serverless';
 * export const handler = createLambdaHandler(app);
 * ```
 *
 * The sophisticated internals (an adapter-scoped `EventMapper` registry, the
 * shared `Context` execution model, warm-instance reuse, timeout→504) stay out
 * of your way. *Internal complexity must never become user complexity.*
 *
 * @packageDocumentation
 * @module @nextrush/adapter-serverless
 */

// ─── Tier 1: per-provider handlers (what 95% of users import) ───────────────
export { createLambdaHandler } from './lambda';
export type { LambdaEvent, LambdaResult } from './lambda';
export { createGoogleHandler } from './google';
export { createAzureHandler } from './azure';
export type { ServerlessHandlerOptions } from './types';
// (Cloudflare's Tier-1 handler ships in @nextrush/adapter-edge as createCloudflareHandler.)

// ─── Advanced / Runtime authors only (Tier 3) ──────────────────────────────
// You need these ONLY to add a platform NextRush doesn't ship (Oracle, Fly.io,
// OpenFaaS, an internal platform). Application developers should use a Tier-1
// handler above and never import from here.
export { createServerlessAdapter } from './adapter';
export type { EventMapper, ServerlessAdapterOptions, ServerlessHandler } from './types';

// Built-in mappers (Tier 3 building blocks — the Tier-1 handlers wire these for you)
export { lambdaFunctionUrl } from './mappers/lambda-function-url';
export type {
  LambdaFunctionUrlEvent,
  LambdaFunctionUrlResult,
} from './mappers/lambda-function-url';

export { apigwV2 } from './mappers/apigw-v2';
export type { ApiGatewayV2Event, ApiGatewayV2Result } from './mappers/apigw-v2';

export { apigwV1 } from './mappers/apigw-v1';
export type { ApiGatewayV1Event, ApiGatewayV1Result } from './mappers/apigw-v1';

export { gcf } from './mappers/gcf';
export type { GcfEvent, GcfResult } from './mappers/gcf';

export { azure } from './mappers/azure';
export type { AzureEvent, AzureResult } from './mappers/azure';

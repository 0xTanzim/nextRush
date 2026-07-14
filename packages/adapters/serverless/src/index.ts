/**
 * @nextrush/adapter-serverless - Serverless adapter for NextRush
 *
 * Maps native serverless events (AWS Lambda Function URL / API Gateway v2, and —
 * as they land — GCF and Azure) to the shared `Context` pipeline via a generic,
 * adapter-scoped `EventMapper` registry. Execution model (per-invocation,
 * stateless, timeout→504, warm `ready()` reuse) is shared with the edge adapter.
 *
 * @packageDocumentation
 * @module @nextrush/adapter-serverless
 */

export { createServerlessAdapter } from './adapter';
export type { EventMapper, ServerlessAdapterOptions, ServerlessHandler } from './types';

// Built-in mappers
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
